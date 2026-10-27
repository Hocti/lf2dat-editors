# 舊版 LF2（1.x／2.0）的 .dat：跳過前 123 個位元組，每個位元組減去金鑰，再用 Big5 解成文字。
# 金鑰與 src/shared/legacyModFiles.ts 的 decryptDat 相同。明文檔（已有 <bmp_begin> 等）不解密。
# Old LF2 (1.x / 2.0) .dat: skip the first 123 bytes, subtract the key from each byte, then decode as Big5.
# The key matches decryptDat in src/shared/legacyModFiles.ts. Plain files (they already contain <bmp_begin> and so on) are not decrypted.

import os
import re
import sys
import time

try:
    import sublime
    import sublime_plugin
except ImportError:
    sublime = None
    sublime_plugin = None

DAT_KEY = b'odBearBecauseHeIsVeryGoodSiuHungIsAGo'
DAT_HEADER = 123
# 物件、背景、關卡解密後一定看得到其中一個。 / An object, background, or stage file shows one of these after decrypt.
MARKER = re.compile(br'<bmp_begin>|<frame>|<stage>|<background>|layer:')
SYNTAX = 'Packages/LF2 Data/LF2 Data.sublime-syntax'


def decrypt_body(data):
    # 只解密，不判斷是不是 LF2。 / Decrypt only; this does not check that the file is LF2.
    if len(data) <= DAT_HEADER:
        return b''
    key = DAT_KEY
    out = bytearray(len(data) - DAT_HEADER)
    for index in range(len(out)):
        out[index] = (data[index + DAT_HEADER] - key[index % len(key)]) & 255
    return bytes(out)


def decode_dat(data):
    # 是 LF2 資料才回傳文字，否則 None（不要把別的 .dat 換掉）。
    # Returns text only when this is LF2 data, otherwise None (leave other .dat files alone).
    if MARKER.search(data[:512]):
        body = data
    else:
        body = decrypt_body(data)
        if not MARKER.search(body[:8000]):
            return None
    return body.decode('big5', 'replace').replace('\x00', '')


def _assign_syntax(view):
    if hasattr(view, 'assign_syntax'):
        view.assign_syntax(SYNTAX)
    else:
        view.set_syntax_file(SYNTAX)


def _auto_decode():
    if sublime is None:
        return True
    return sublime.load_settings('LF2 Data.sublime-settings').get('auto_decode_on_open', True)


_recent = {}


def show_decoded(window, path, source_view=None):
    # 加密檔開成唯讀暫存；明文檔只套語法，仍是原本那個檔。
    # Encrypted files open as a read-only scratch view; plain files only get the syntax, and stay the real file.
    try:
        with open(path, 'rb') as handle:
            data = handle.read()
    except OSError as error:
        if sublime is not None:
            sublime.status_message('LF2: cannot read file ({})'.format(error))
        return
    if MARKER.search(data[:512]):
        # 明文沒有暫存視窗可關。從檔案總管點的話，直接開原檔，on_load 會套語法。
        # A plain file has no scratch view to close. From the file dialog, open the real file; on_load applies the syntax.
        if source_view is not None and source_view.is_valid():
            _assign_syntax(source_view)
            sublime.status_message('LF2: plain data file')
        elif window is not None:
            window.open_file(path)
        return
    text = decode_dat(data)
    if text is None:
        if sublime is not None:
            sublime.status_message('LF2: not an LF2 data file')
        return
    # on_load 與指令可能接連觸發。 / on_load and a command can both fire.
    key = os.path.normcase(os.path.abspath(path))
    now = time.time()
    if key in _recent and now - _recent[key] < 1:
        return
    _recent[key] = now
    view = window.new_file()
    view.set_name(os.path.basename(path) + ' (LF2)')
    _assign_syntax(view)
    view.run_command('lf2_set_text', {'text': text})
    view.set_scratch(True)
    view.set_read_only(True)
    if source_view is not None and source_view.is_valid():
        source_view.set_scratch(True)
        source_view.close()
    sublime.status_message('LF2: decoded {}'.format(os.path.basename(path)))


if sublime_plugin is not None:

    class Lf2SetTextCommand(sublime_plugin.TextCommand):
        def run(self, edit, text=''):
            self.view.replace(edit, sublime.Region(0, self.view.size()), text)

    class Lf2OpenDatCommand(sublime_plugin.WindowCommand):
        def run(self, paths=None):
            targets = [path for path in (paths or []) if path and not os.path.isdir(path)]
            if not targets:
                if hasattr(sublime, 'open_dialog'):
                    sublime.open_dialog(lambda picked: self._picked(picked), [('LF2 data', ['dat'])])
                else:
                    self.window.show_input_panel('LF2 data path:', '', lambda picked: show_decoded(self.window, picked), None, None)
                return
            for path in targets:
                show_decoded(self.window, path)

        def _picked(self, picked):
            if not picked:
                return
            paths = picked if isinstance(picked, (list, tuple)) else [picked]
            for path in paths:
                show_decoded(self.window, path)

        def is_visible(self, paths=None):
            if not paths:
                return True
            return any(str(path).lower().endswith('.dat') for path in paths)

    class Lf2DecodeViewCommand(sublime_plugin.WindowCommand):
        def run(self):
            view = self.window.active_view()
            path = view.file_name() if view is not None else None
            if not path:
                sublime.status_message('LF2: the current view is not a file')
                return
            show_decoded(self.window, path, view)

        def is_visible(self):
            view = self.window.active_view()
            name = view.file_name() if view is not None else ''
            return bool(name) and name.lower().endswith('.dat')

    class Lf2DatListener(sublime_plugin.EventListener):
        def on_load(self, view):
            if not _auto_decode():
                return
            path = view.file_name()
            if not path or not path.lower().endswith('.dat'):
                return

            def later(tries=0):
                if not view.is_valid():
                    return
                window = view.window()
                if window is None and tries < 5:
                    sublime.set_timeout(lambda: later(tries + 1), 50)
                    return
                if window is None:
                    return
                show_decoded(window, path, view)

            sublime.set_timeout(later, 0)


if __name__ == '__main__':
    sample = sys.argv[1] if len(sys.argv) > 1 else ''
    assert decode_dat(b'MZ' + b'\x00' * 200) is None
    if not sample:
        print('ok')
    else:
        with open(sample, 'rb') as handle:
            text = decode_dat(handle.read())
        if text is None:
            sys.exit('not lf2 data')
        sys.stdout.buffer.write(text.encode('utf-8'))
