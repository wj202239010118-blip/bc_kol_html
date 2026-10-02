#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""serve.py — kol-ui-next 开发用静态服务（发送 no-store，避免浏览器缓存旧 js/css）。"""
import functools
import http.server
import os
import socketserver

PORT = int(os.environ.get("KOL_UI_PORT", "8091"))
DIR = os.path.dirname(os.path.abspath(__file__))


class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *a):
        pass


Handler = functools.partial(H, directory=DIR)
socketserver.TCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print("no-cache serving %s on http://127.0.0.1:%d/" % (DIR, PORT), flush=True)
    httpd.serve_forever()
