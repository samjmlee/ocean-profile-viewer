import unittest,tempfile,json
from pathlib import Path
from types import SimpleNamespace
import numpy as np
import gsw
from netCDF4 import Dataset
from ocean_viewer.convert import classify,convert,epoch,profile_axis

def options(path,out,**kw):
    args=dict(input=str(path),output=str(out),name='TEST',level='L3',product='native',qc='good',mapping=None,source_url='',whoi=True,absolute_pressure_offset=None,gps_max_hours=6,start=None,end=None,max_profiles=None)
    args.update(kw);return SimpleNamespace(**args)

def fixture(path,absolute=False,transpose=False,conductivity=False):
    with Dataset(path,'w') as f:
        f.createDimension('record_number',2);f.createDimension('sample_count',4)
        c=f.createGroup('ctd');info=f.createGroup('profile_info')
        for name,vals in [('ts_profile_start',[20000,20001]),('latitude',[80,80]),('longitude',[-140,-140])]:
            v=info.createVariable(name,'f8',('record_number',));v[:]=vals
            if name.startswith('ts_'):v.units='days since 1970-01-01'
        v=info.createVariable('profile_dir','i4',('record_number',));v[:]=[1,-1];v.description='1 = up, -1 = down, 0 = stationary'
        dims=('sample_count','record_number') if transpose else ('record_number','sample_count')
        for name,units,a in [('absolute_pressure' if absolute else 'press_filt','dbar',[[1,1.25,1.5,1.75]]*2),('temp_cor','degree_Celcius',[[-1.6]*4]*2),('not_used' if conductivity else 'salinity_adj','PSU',[[30]*4]*2)]:
            v=c.createVariable(name,'f8',dims);v.units=units;arr=np.array(a)
            if name=='absolute_pressure':arr=arr+10.1325
            v[:]=arr.T if transpose else arr
        if conductivity:
            v=c.createVariable('conductivity','f8',dims);v.units='S/m'
            v[:]=gsw.C_from_SP(30,c['temp_cor'][:],c['press_filt'][:])/10
        for name in ['press_flag','temp_flag','sal_flag']:
            v=c.createVariable(name,'i4',('record_number',));v[:]=[1,2];v.description='0 = no QC performed, 1 = good data, 2 = questionable, 4 = bad profile'

class ConversionTests(unittest.TestCase):
    def test_boundaries(self):
        np.testing.assert_array_equal(classify(np.array([-1,0,1,2,3,4,np.nan]),[0,1,3,4]),[3,0,1,1,2,2,3])
        np.testing.assert_array_equal(classify(np.arange(5),[0,3,2,4]),[3]*5)
    def test_timezone(self):self.assertEqual(epoch('2024-01-01T00:00:00-04:00'),epoch('2024-01-01T04:00:00Z'))
    def test_l3_qc_and_spacing(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/'test.nc';fixture(p)
            d=convert(options(p,Path(td)/'out.json'))
            self.assertEqual(len(d['records']),1);self.assertEqual(d['provenance']['statistics']['qc_excluded_profiles'],1)
            self.assertEqual(d['sampling']['median_positive_pressure_spacing_dbar'],.25)
            self.assertEqual(d['records'][0]['segments']['up']['p'],[1,1.25,1.5,1.75])
            d=convert(options(p,Path(td)/'out.json',qc='not-bad'))
            self.assertEqual(len(d['records']),2);self.assertEqual(len(d['records'][1]['segments']['down']['p']),4)
    def test_transposition_and_absolute(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/'test.nc';fixture(p,absolute=True,transpose=True)
            with self.assertRaisesRegex(ValueError,'Absolute pressure'):convert(options(p,Path(td)/'out.json'))
            d=convert(options(p,Path(td)/'out.json.gz',absolute_pressure_offset=10.1325))
            self.assertEqual(d['records'][0]['segments']['up']['p'],[1,1.25,1.5,1.75])
    def test_ambiguous_axes(self):
        v=SimpleNamespace(dimensions=('a','b'),shape=(2,2),name='ambiguous')
        with self.assertRaisesRegex(ValueError,'Ambiguous'):profile_axis(v,2,{})
    def test_conductivity_units_and_thermodynamics(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/'test.nc';fixture(p,conductivity=True)
            d=convert(options(p,Path(td)/'out.json'))
            q=d['records'][0]['segments']['up'];np.testing.assert_allclose(q['raw'][1],[30]*4,atol=1e-6)
            pressure=np.array(q['p']);sa=gsw.SA_from_SP(30,pressure,-140,80)
            np.testing.assert_allclose(q['raw'][2],-1.6-gsw.t_freezing(sa,pressure,0),atol=1e-6)
    def test_csv_no_invented_phase(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/'test.csv';p.write_text('profile_id,time_utc,latitude,longitude,pressure_dbar,temperature_c,salinity_pss78\n1,2024-01-01T00:00:00Z,80,-140,1,-1.6,30\n1,2024-01-01T00:00:00Z,80,-140,1.25,-1.5,30.1\n')
            d=convert(options(p,Path(td)/'out.json'))
            self.assertEqual(len(d['records'][0]['segments']['unknown']['p']),2)
            self.assertFalse(d['records'][0]['phaseValid'])
if __name__=='__main__':unittest.main()
