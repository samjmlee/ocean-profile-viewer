"""Serve only public viewer assets on loopback; no upload endpoint."""
import argparse
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import webbrowser

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=8767)
    parser.add_argument('--open',action='store_true')
    args=parser.parse_args()
    directory=Path(__file__).resolve().parent/'web'
    server=ThreadingHTTPServer(('127.0.0.1',args.port),partial(SimpleHTTPRequestHandler,directory=str(directory)))
    url=f'http://127.0.0.1:{args.port}/'
    print(f'Ocean Profile Viewer: {url}',flush=True)
    if args.open:webbrowser.open(url)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()
