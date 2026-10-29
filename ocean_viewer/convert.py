"""Explicit, local profile conversion. No network access and no calibration fit."""
from pathlib import Path
from datetime import datetime, timezone
import csv, gzip, hashlib, json
import numpy as np
import gsw
from netCDF4 import Dataset, num2date, date2num

PHASES=('up','pause','down','unknown')
ALIASES={
 'pressure':['ctd/press_filt','data/P','ctd/pressure','ctd/PRES','ctd/absolute_pressure','pressure','PRES'],
 'temperature':['ctd/temp_cor','data/T','ctd/temperature','ctd/TEMP','temperature','TEMP'],
 'salinity':['ctd/salinity_adj','data/S','ctd/salinity','ctd/PSAL','salinity','PSAL'],
 'conductivity':['ctd/conductivity','conductivity','CNDC'],
 'time':['profile_info/ts_profile_start','profile_info/profile_start','profile_info/time','ctd/TIME','time','TIME'],
 'latitude':['profile_info/latitude','ctd/LATITUDE','latitude','LATITUDE'],
 'longitude':['profile_info/longitude','ctd/LONGITUDE','longitude','LONGITUDE'],
 'sample_time':['ctd/time'],
 'start':['profile_info/ts_profile_start'], 'pause_start':['profile_info/ts_pause_start'],
 'pause_stop':['profile_info/ts_pause_stop'], 'stop':['profile_info/ts_profile_stop']}

def clean(a):
    a=np.asarray(a,dtype=float)
    return np.where(np.isfinite(a),np.round(a,6),None).tolist()

def epoch(value):
    dt=datetime.fromisoformat(value.replace('Z','+00:00'))
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).timestamp()*1000

def classify(times,bounds):
    out=np.full(len(times),3,dtype=np.uint8)
    a,b,c,d=bounds
    if np.all(np.isfinite(bounds)) and a<=b<=c<=d:
        out[(times>=a)&(times<b)]=0;out[(times>=b)&(times<c)]=1;out[(times>=c)&(times<=d)]=2
    return out

def make_record(identifier,time,lat,lon,p,t,s,labels,bounds,stats):
    p,t,s=np.asarray(p,float),np.asarray(t,float),np.asarray(s,float)
    stats['input_samples']+=len(p)
    # Broad physical sanity filter, explicitly NOT provider QC or calibration.
    ok=np.isfinite(p)&(p>=0)&(p<=12000)&np.isfinite(t)&(t>=-5)&(t<=45)&np.isfinite(s)&(s>=0)&(s<=50)
    p,t,s,labels=p[ok],t[ok],s[ok],np.asarray(labels)[ok]
    if not len(p):stats['empty_profiles']+=1;return None
    sa=gsw.SA_from_SP(s,p,lon,lat);ct=gsw.CT_from_t(sa,t,p)
    raw=np.array([t,s,t-gsw.t_freezing(sa,p,0),gsw.sigma0(sa,ct)])
    z=-gsw.z_from_p(p,lat);segments={}
    for k,key in enumerate(PHASES):
        m=labels==k;order=np.argsort(p[m],kind='stable');pp=p[m][order]
        segments[key]={'p':clean(pp),'z':clean(z[m][order]),'raw':clean(raw[:,m][:,order]),'pmin':float(pp.min()) if len(pp) else None,'pmax':float(pp.max()) if len(pp) else None}
    stats['retained_samples']+=len(p)
    return dict(id=identifier,t=float(time),lat=float(lat),lon=float(lon),bounds=clean(bounds),phaseValid=bool(np.all(np.isfinite(bounds)) and np.all(np.diff(bounds)>=0)),segments=segments)

def values(v):return np.asarray(np.ma.filled(v[:].astype(float),np.nan),float)

def time_values(v):
    a=values(v);cal=getattr(v,'calendar','standard')
    if cal not in ('standard','gregorian','proleptic_gregorian'):raise ValueError(f'Calendar {cal} cannot be displayed as UTC Gregorian.')
    units=getattr(v,'units',None)
    if not units or 'since' not in units:raise ValueError(f'{v.name}: missing CF time units.')
    out=np.full(a.shape,np.nan);ok=np.isfinite(a)
    if ok.any():out[ok]=date2num(num2date(a[ok],units,calendar=cal),'seconds since 1970-01-01',calendar=cal)*1000
    return out

def getvar(ds,key,mapping,required=False):
    for name in ([mapping[key]] if key in mapping else ALIASES[key]):
        try:return ds[name]
        except (IndexError,KeyError):pass
    if required:raise ValueError(f'Cannot locate {key}; use --mapping with its NetCDF path.')
    return None

def profile_axis(v,n,mapping):
    if 'profile_axis' in mapping:
        axis=int(mapping['profile_axis'])
        if axis not in (0,1) or v.shape[axis]!=n:raise ValueError('Mapped profile_axis has the wrong length.')
        return axis
    named=[i for i,d in enumerate(v.dimensions) if 'profile' in d.lower() or d.upper() in ('TIME','N_PROF','RECORD_NUMBER')]
    if len(named)==1 and v.shape[named[0]]==n:return named[0]
    candidates=[i for i,x in enumerate(v.shape) if x==n]
    if len(candidates)!=1:raise ValueError(f'Ambiguous profile axis for {v.name}, dimensions {v.dimensions}; supply profile_axis.')
    return candidates[0]

def profile_row(v,i,n,mapping):
    if v.ndim==1:return values(v)
    if v.ndim!=2:raise ValueError(f'{v.name}: expected a 1D level vector or 2D profile array.')
    axis=profile_axis(v,n,mapping);a=v[i,:] if axis==0 else v[:,i]
    return np.asarray(np.ma.filled(a.astype(float),np.nan),float)

def unit(v,allowed,override=None):
    u=str(override or getattr(v,'units','')).lower().replace(' ','').replace('°','').replace('_','').replace('^','')
    if u not in allowed:raise ValueError(f'{v.name}: unsupported or missing units {getattr(v,"units",None)!r}; supply an explicit unit override in mapping.')
    return u

def netcdf_records(path,args,stats):
    mapping=json.loads(Path(args.mapping).read_text()) if args.mapping else {}
    with Dataset(path) as ds:
        tv=getvar(ds,'time',mapping,True);times=time_values(tv)
        if times.ndim!=1:raise ValueError('Profile time must be a 1D vector; map a profile-level time variable.')
        n=len(times);pv=getvar(ds,'pressure',mapping,True);temp=getvar(ds,'temperature',mapping,True)
        sal=getvar(ds,'salinity',mapping);cond=getvar(ds,'conductivity',mapping)
        if sal is None and cond is None:raise ValueError('Need Practical Salinity or conductivity.')
        unit(pv,{'dbar','decibar','decibars','db'},mapping.get('pressure_units'))
        unit(temp,{'degc','degreecelsius','degreescelsius','c','celsius','degreecelcius','degreescelcius','degreec','degreesc','its-90','its90'},mapping.get('temperature_units'))
        if sal is not None:unit(sal,{'psu','pss-78','pss78','1','pss','practicalsalinityunit','practicalsalinityunits'},mapping.get('salinity_units'))
        factor=1
        if sal is None:
            cu=unit(cond,{'ms/cm','mscm-1','s/m','sm-1'},mapping.get('conductivity_units'));factor=10 if cu in ('s/m','sm-1') else 1
        absolute='absolute' in pv.name.lower() or 'absolute' in str(getattr(pv,'long_name','')).lower()
        if absolute and args.absolute_pressure_offset is None:raise ValueError('Absolute pressure needs an explicit --absolute-pressure-offset in dbar (e.g. 10.1325 only when justified by metadata).')
        offset=args.absolute_pressure_offset or 0
        latv,lonv=getvar(ds,'latitude',mapping),getvar(ds,'longitude',mapping)
        gps=False
        if latv is not None and lonv is not None:
            lat,lon=values(latv),values(lonv)
            if lat.shape!=(n,) or lon.shape!=(n,):raise ValueError('Profile latitude/longitude must align with profile time.')
        else:
            try:st=time_values(ds['surf/time']);slat=values(ds['surf/latitude']);slon=values(ds['surf/longitude'])
            except (IndexError,KeyError):raise ValueError('No profile positions or surf GPS found. Supply latitude/longitude mapping.')
            good=np.isfinite(st)&np.isfinite(slat)&np.isfinite(slon);order=np.argsort(st[good]);st,slat,slon=st[good][order],slat[good][order],slon[good][order]
            lat=np.full(n,np.nan);lon=lat.copy();gps=True
            for i,t in enumerate(times):
                if not np.isfinite(t) or not len(st):continue
                j=int(np.argmin(abs(st-t)))
                if abs(st[j]-t)<=args.gps_max_hours*3600000:lat[i],lon[i]=slat[j],slon[j]
        lon=np.where((lon>180)&(lon<=360),lon-360,lon)
        bounds_vars=[getvar(ds,k,mapping) for k in ('start','pause_start','pause_stop','stop')]
        bounds_arrays=[time_values(v) if v is not None else np.full(n,np.nan) for v in bounds_vars]
        if any(a.shape!=(n,) for a in bounds_arrays):raise ValueError('Motor boundaries do not align with profiles.')
        sv=getvar(ds,'sample_time',mapping);records=[]
        qc_arrays={}
        for key in ('ctd/press_flag','ctd/temp_flag','ctd/sal_flag','data/P_flag','data/T_flag','data/S_flag','profile_info/gps_flag'):
            try:v=ds[key]
            except (KeyError,IndexError):continue
            description=str(getattr(v,'description','')).lower().replace(' ','')
            if '1=good' not in description:raise ValueError(f'Unrecognized QC convention for {key}; inspect provider documentation.')
            if v.shape!=(n,):raise ValueError(f'Unsupported QC dimensions for {key}')
            qc_arrays[key]=values(v)
        direction=None
        try:
            dv=ds['profile_info/profile_dir'];description=str(getattr(dv,'description','')).lower().replace(' ','')
            if '1=up' in description and '-1=down' in description and dv.shape==(n,):direction=values(dv)
        except (IndexError,KeyError):pass
        for i in np.argsort(times):
            tm=times[i]
            if not np.isfinite(tm) or not np.isfinite(lat[i]) or not np.isfinite(lon[i]) or abs(lat[i])>90 or abs(lon[i])>180:stats['unpositioned_profiles']+=1;continue
            if args.start and tm<epoch(args.start) or args.end and tm>=epoch(args.end):continue
            qc={key:float(a[i]) if np.isfinite(a[i]) else None for key,a in qc_arrays.items()}
            if args.qc=='good' and any(v!=1 for v in qc.values()) or args.qc=='not-bad' and any(v==4 for v in qc.values()):
                stats['qc_excluded_profiles']+=1;continue
            p=profile_row(pv,i,n,mapping)-offset;t=profile_row(temp,i,n,mapping)
            s=profile_row(sal,i,n,mapping) if sal is not None else gsw.SP_from_C(profile_row(cond,i,n,mapping)*factor,t,p)
            if len(p)!=len(t) or len(p)!=len(s):raise ValueError('CTD vectors are not aligned.')
            bounds=np.array([a[i] for a in bounds_arrays]);labels=np.full(len(p),3)
            phase_method='unclassified'
            if sv is not None and np.all(np.isfinite(bounds)) and np.all(np.diff(bounds)>=0):
                sample=profile_row(sv,i,n,mapping);units=getattr(sv,'units','');cal=getattr(sv,'calendar','standard')
                if cal not in ('standard','gregorian','proleptic_gregorian') or 'since' not in units:raise ValueError('Sample clock needs Gregorian CF units.')
                mask=np.isfinite(sample);clock=np.full(sample.shape,np.nan)
                if mask.any():clock[mask]=date2num(num2date(sample[mask],units,calendar=cal),'seconds since 1970-01-01',calendar=cal)*1000
                if len(clock)!=len(p):raise ValueError('Sample clock is not aligned with CTD.')
                labels=classify(clock,bounds)
                phase_method='motor-time boundaries'
            elif direction is not None and direction[i] in (1,-1):
                labels[:]=0 if direction[i]==1 else 2
                phase_method='provider profile_dir (1=up, -1=down); stationary is not assumed near ice'
            r=make_record(int(i),tm,lat[i],lon[i],p,t,s,labels,bounds,stats)
            if r:
                r['qc']=qc;r['phaseMethod']=phase_method;r['flags']='; '.join(f'{k}: {v}' for k,v in qc.items() if v!=1)
                records.append(r)
            if args.max_profiles and len(records)>=args.max_profiles:break
        return records,dict(variable_mapping={key:(getvar(ds,key,mapping).group().path.rstrip('/')+'/'+getvar(ds,key,mapping).name) for key in ALIASES if getvar(ds,key,mapping) is not None},pressure_offset_subtracted_dbar=offset,position_method=f'nearest surface GPS within {args.gps_max_hours} h; not underwater position' if gps else 'supplied profile position',salinity_method='supplied Practical Salinity' if sal is not None else f'GSW SP_from_C, conductivity factor {factor} to mS/cm',provider_qc=f'{args.qc}: recognized WHOI profile flags {list(qc_arrays)}; fill values masked. No flags means QC unavailable, not passed.')

def csv_records(path,args,stats):
    groups={}
    with open(path,newline='',encoding='utf-8-sig') as f:
        reader=csv.DictReader(f)
        required={'profile_id','time_utc','latitude','longitude','pressure_dbar','temperature_c','salinity_pss78'}
        if not required.issubset(reader.fieldnames or []):raise ValueError('CSV missing required columns: '+', '.join(sorted(required-set(reader.fieldnames or []))))
        for row in reader:groups.setdefault(row['profile_id'],[]).append(row)
    records=[]
    for identifier,rows in sorted(groups.items(),key=lambda item:epoch(item[1][0]['time_utc'])):
        if args.max_profiles and len(records)>=args.max_profiles:break
        first=rows[0];tm=epoch(first['time_utc']);lat=float(first['latitude']);lon=float(first['longitude'])
        if not np.isfinite(lat) or not np.isfinite(lon) or abs(lat)>90 or abs(lon)>180:stats['unpositioned_profiles']+=1;continue
        if args.start and tm<epoch(args.start) or args.end and tm>=epoch(args.end):continue
        if any(row['time_utc']!=first['time_utc'] or float(row['latitude'])!=lat or float(row['longitude'])!=lon for row in rows):raise ValueError('Each CSV profile_id must have one profile time and location.')
        phase=[row.get('phase','unknown') or 'unknown' for row in rows]
        if any(k not in PHASES for k in phase):raise ValueError('CSV phase must be up, pause, down or unknown.')
        p,t,s=[np.array([float(row[k]) if row[k].strip() else np.nan for row in rows]) for k in ('pressure_dbar','temperature_c','salinity_pss78')]
        r=make_record(identifier,tm,lat,lon,p,t,s,[PHASES.index(k) for k in phase],[np.nan]*4,stats)
        if r:records.append(r)
    records.sort(key=lambda r:r['t'])
    if args.max_profiles:records=records[:args.max_profiles]
    return records,dict(position_method='supplied CSV profile coordinates',phase_method='user-supplied CSV phase; unknown when absent',pressure_offset_subtracted_dbar=0,salinity_method='supplied Practical Salinity',provider_qc='User is responsible for source QC; no QC flag interpretation.')

def convert(args):
    path=Path(args.input);stats=dict(input_samples=0,retained_samples=0,empty_profiles=0,unpositioned_profiles=0,qc_excluded_profiles=0)
    records,details=csv_records(path,args,stats) if path.suffix.lower()=='.csv' else netcdf_records(path,args,stats)
    if not records:raise ValueError('No positioned, valid profiles in the requested interval.')
    with path.open('rb') as f:sha=hashlib.file_digest(f,'sha256').hexdigest()
    positive=np.diff([r['t'] for r in records]);positive=positive[positive>0]
    spacings=[]
    for r in records:
        for q in r['segments'].values():
            dp=np.diff(q['p']);dp=dp[dp>1e-6]
            if len(dp):spacings.append(float(np.median(dp)))
    sampling=dict(median_positive_pressure_spacing_dbar=float(np.median(spacings)) if spacings else None,definition='Median of per-profile/phase median positive sorted pressure increments; sampling interval, NOT effective resolving power.',native_samples_retained=True)
    d=dict(schema='ocean-profile-viewer/1',name=args.name,level=args.level,product=args.product,sampling=sampling,synthetic=False,gapMs=float(np.quantile(positive,.9)*1.75) if len(positive) else 6*3600000,records=records,
      provenance=dict(source=path.name,source_url=args.source_url,sha256=sha,converted_utc=datetime.now(timezone.utc).isoformat(),converter_version='0.1.0',gsw_version=gsw.__version__,numpy_version=np.__version__,data_citation='https://doi.org/10.7289/v5mw2f7x' if args.whoi else args.source_url,conductivity_calibration='No additional offset applied',derived='SA_from_SP; CT_from_t; t - t_freezing(SA,p,0); sigma0(SA,CT); depth = -z_from_p(p,latitude)',screening='Finite P/T/SP; P 0–12000 dbar, T -5–45 C, SP 0–50. Broad sanity checks only; no sensor-response correction.',selection=dict(start_inclusive=args.start,end_exclusive=args.end,max_profiles=args.max_profiles),statistics=stats,**details))
    output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    opener=gzip.open if output.suffix=='.gz' else open
    with opener(output,'wt',encoding='utf-8') as f:json.dump(d,f,separators=(',',':'),allow_nan=False)
    print(f'{len(records)} profiles written to {output}; {stats}',flush=True)
    return d
