import argparse,json,sys
from pathlib import Path
from .convert import convert

def main():
    parser=argparse.ArgumentParser(description='Prepare local TOP/ITP observations for Ocean Profile Viewer.')
    sub=parser.add_subparsers(dest='command',required=True)
    c=sub.add_parser('convert',help='Convert NetCDF or standard CSV to browser JSON[.gz]')
    c.add_argument('input');c.add_argument('--name',required=True);c.add_argument('--level',required=True,choices=['L1','L2','L3','unknown'])
    c.add_argument('--output',required=True);c.add_argument('--mapping');c.add_argument('--source-url',default='');c.add_argument('--whoi',action='store_true',help='Attach WHOI/NOAA program data citation')
    c.add_argument('--product',choices=['native','gridded','unknown'],default='unknown',help='Declare supplied sampling product; do not infer resolution from level alone')
    c.add_argument('--qc',choices=['good','not-bad','all'],default='good',help='Recognized WHOI flags: good=only 1; not-bad=exclude 4; all=keep flags. Missing flags remain explicitly unverified.')
    c.add_argument('--absolute-pressure-offset',type=float);c.add_argument('--gps-max-hours',type=float,default=6)
    c.add_argument('--start',help='Inclusive ISO UTC date/time');c.add_argument('--end',help='Exclusive ISO UTC date/time');c.add_argument('--max-profiles',type=int)
    i=sub.add_parser('inspect',help='List NetCDF variable paths, dimensions and units without conversion');i.add_argument('input')
    args=parser.parse_args()
    try:
        if args.command=='convert':
            if args.max_profiles is not None and args.max_profiles<1:raise ValueError('--max-profiles must be positive')
            if args.gps_max_hours<=0:raise ValueError('--gps-max-hours must be positive')
            convert(args)
        else:
            from netCDF4 import Dataset
            with Dataset(args.input) as ds:
                def visit(group):
                    for key,v in group.variables.items():print(json.dumps(dict(path=group.path.rstrip('/')+'/'+key,shape=v.shape,dimensions=v.dimensions,units=getattr(v,'units',None))))
                    for child in group.groups.values():visit(child)
                visit(ds)
    except (ValueError,OSError,KeyError,IndexError) as e:parser.exit(2,f'Conversion stopped: {e}\n')
if __name__=='__main__':main()
