"""Deterministic synthetic CTD demonstration. No real observations redistributed."""
from pathlib import Path
import sys,json
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import numpy as np
from ocean_viewer.convert import make_record

def generate():
    records=[];stats=dict(input_samples=0,retained_samples=0,empty_profiles=0)
    for i in range(32):
        a=1704067200000+i*21600000
        up=np.arange(1,60.01,.25);pause=1+np.arange(20)*.002;down=up[::-1]
        p=np.r_[up,pause,down];labels=np.r_[np.zeros(len(up),int),np.ones(len(pause),int),np.full(len(down),2)]
        t=-1.65+.45*np.exp(-((p-12-i*.15)/5)**2)+.002*p+.04*np.sin(i/5)
        s=29+3*(1-np.exp(-p/28))+.12*np.cos(i/7)
        r=make_record(i,a,79+i*.025,-145+i*.12,p,t,s,labels,[a,a+600000,a+630000,a+1200000],stats)
        r['phaseMethod']='synthetic motor phases';records.append(r)
    d=dict(schema='ocean-profile-viewer/1',name='Synthetic Arctic drift',level='unknown',product='native',synthetic=True,gapMs=43200000,sampling=dict(median_positive_pressure_spacing_dbar=.25,definition='Constructed up/down sampling interval; pause spacing is 0.002 dbar.'),records=records,provenance=dict(source='Deterministic mathematical demo',license='MIT (synthetic demo only)',method='Synthetic temperature/salinity curves; TEOS-10 derived quantities. Not WHOI observations; not a calibrated model.'))
    dest=Path(__file__).resolve().parents[1]/'web/demo/synthetic.json';dest.write_text(json.dumps(d,separators=(',',':'),allow_nan=False),encoding='utf-8')
    print(dest.name,dest.stat().st_size)
if __name__=='__main__':generate()
