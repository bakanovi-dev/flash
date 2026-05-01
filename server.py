from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

class SpaHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.translate_path(self.path)
        if os.path.isfile(path):
            super().do_GET()
        else:
            self.path = '/index.html'
            super().do_GET()

    def log_message(self, format, *args):
        print(f"{self.address_string()} - {format % args}")

if __name__ == '__main__':
    server = HTTPServer(('', 8080), SpaHandler)
    print("Serving at http://localhost:8080")
    server.serve_forever()
