# iOS Paste and Undo Paste Notes

## Scope

Flashify accepts normal text pastes in Safari and the installed iPhone PWA. The
native iOS **Undo Paste** prompt can appear after a paste when the phone is
moved; it is part of the system `Shake to Undo` behavior, not an app dialog.

## Product decision

Do not try to suppress this prompt in web code. Safari/PWAs do not provide a
supported API to disable it, and intercepting paste or undo would make normal
text editing less reliable.

The user can disable the system gesture on their device:

`Settings > Accessibility > Touch > Shake to Undo`

Apple also documents the alternative three-finger undo gesture. Reference:
[Undo or redo typing on iPhone](https://support.apple.com/en-mide/guide/iphone/iph77bcdd132/ios).

## App audit (2026-07-12)

- Flashify has no `onPaste` handlers and does not programmatically modify text
  after a user paste.
- The only clipboard helper is the explicit **Copy AI prompt** action in the
  deck detail screen; it writes to the clipboard and does not read pasted text.
- Inputs and textareas remain ordinary controlled React fields, so normal iOS
  paste, selection, and undo behavior is preserved.

## Physical-device verification

Desktop browser emulation cannot produce the iPhone motion gesture. Verify on
an iPhone by pasting into an import or card-edit textarea, moving the device,
then confirming that the system prompt is the only popup and the pasted text is
not duplicated or changed by Flashify.
