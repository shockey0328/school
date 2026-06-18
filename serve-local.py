# -*- coding: utf-8 -*-
"""本地静态站：自动选端口、启动后再打开浏览器。"""
from __future__ import annotations

import copy
import http.server
import os
import socket
import socketserver
import subprocess
import sys
import threading
import time
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)


class GuangdaRequestHandler(http.server.SimpleHTTPRequestHandler):
    """与常见线上静态服务一致：为文本类资源附带 charset=utf-8，减少中文 CSV 乱码差异。"""

    def end_headers(self) -> None:
        path = self.path.split("?", 1)[0].lower()
        if path.endswith((".html", ".htm", ".js", ".css")):
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
        super().end_headers()

    extensions_map = copy.copy(http.server.SimpleHTTPRequestHandler.extensions_map)
    extensions_map.update(
        {
            ".csv": "text/csv; charset=utf-8",
            ".html": "text/html; charset=utf-8",
            ".htm": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".mjs": "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".svg": "image/svg+xml; charset=utf-8",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".gif": "image/gif",
            ".ico": "image/x-icon",
        }
    )

# Windows 控制台尽量 UTF-8，避免中文路径打印乱码
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def pick_port(start: int = 8080, tries: int = 30) -> int:
    for p in range(start, start + tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind(("127.0.0.1", p))
            except OSError:
                continue
            return p
    raise SystemExit("找不到可用端口（8080 起连续尝试均失败）")


def write_open_dashboard_url(url: str) -> str | None:
    """写入 Windows 可用的 Internet 快捷方式，双击即可用默认浏览器打开（比自动唤起更稳）。"""
    p = os.path.join(ROOT, "打开看板.url")
    try:
        with open(p, "w", encoding="utf-8") as f:
            f.write("[InternetShortcut]\n")
            f.write("URL=" + url + "\n")
        return p
    except OSError:
        return None


def _try_open_windows(url: str, shortcut_path: str | None) -> bool:
    """依次尝试多种方式，任一成功即返回 True。"""
    # 1) 双击等效的 .url 文件（很多企业环境对 start/webbrowser 拦截较严）
    if shortcut_path and os.path.isfile(shortcut_path):
        try:
            os.startfile(shortcut_path)  # type: ignore[attr-defined]
            return True
        except OSError:
            pass
        except Exception as e:
            print("打开「打开看板.url」失败:", e)

    # 2) 直接打开 http(s) URL
    try:
        os.startfile(url)  # type: ignore[attr-defined]
        return True
    except OSError:
        pass
    except Exception as e:
        print("os.startfile(URL) 失败:", e)

    # 3) ShellExecuteW
    try:
        import ctypes

        rc = int(ctypes.windll.shell32.ShellExecuteW(None, "open", url, None, None, 1))
        if rc > 32:
            return True
        print("ShellExecuteW 返回码:", rc, "（>32 才表示成功）")
    except Exception as e:
        print("ShellExecuteW 失败:", e)

    # 4) rundll32（旧系统常用）
    try:
        subprocess.Popen(
            ["rundll32", "url.dll,FileProtocolHandler", url],
            shell=False,
            close_fds=True,
        )
        return True
    except Exception as e:
        print("rundll32 FileProtocolHandler 失败:", e)

    # 5) cmd /c start
    try:
        subprocess.Popen(["cmd", "/c", "start", "", url], shell=False, close_fds=True)
        return True
    except Exception as e:
        print("cmd start 失败:", e)

    return False


def open_browser(url: str, shortcut_path: str | None) -> None:
    time.sleep(0.5)
    print(f"\n>>> 正在尝试用默认浏览器打开: {url}\n")
    opened = False
    if sys.platform == "win32":
        opened = _try_open_windows(url, shortcut_path)
    if not opened:
        try:
            webbrowser.open(url)
            opened = True
        except Exception as e:
            print("webbrowser.open 失败:", e)

    if not opened:
        print("\n[提示] 未能自动打开浏览器，请任选其一：")
        if shortcut_path:
            print(f"  1) 在资源管理器中双击: {shortcut_path}")
        print("  2) 手动打开浏览器，将下面整行地址复制到地址栏后回车")
        print(f"     {url}\n")
    else:
        print("（若未出现浏览器窗口，请仍按下方「备用打开方式」操作）\n")


def write_url_file(url: str) -> None:
    try:
        p = os.path.join(ROOT, "last-open-url.txt")
        with open(p, "w", encoding="utf-8") as f:
            f.write(url + "\n")
        print(f"（已写入 {p}，可复制其中地址到浏览器）")
    except OSError:
        pass


def main() -> None:
    port = pick_port(8080, 30)
    url = f"http://127.0.0.1:{port}/index.html"
    handler = GuangdaRequestHandler

    shortcut_path = write_open_dashboard_url(url)

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
        write_url_file(url)
        if shortcut_path:
            print(f"（已生成快捷方式: {shortcut_path} — 若浏览器未自动打开，请双击该文件）")

        threading.Thread(
            target=open_browser, args=(url, shortcut_path), daemon=True
        ).start()

        print("============================================")
        print("  学情看板 - 本地服务已启动 (guangfu)")
        print(f"  根目录: {ROOT}")
        print(f"  浏览器地址: {url}")
        print("  备用: 同目录下双击「打开看板.url」或打开 last-open-url.txt 复制地址")
        print("  停止: 在本窗口按 Ctrl+C")
        print("============================================\n")

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n已停止服务。")


if __name__ == "__main__":
    main()
