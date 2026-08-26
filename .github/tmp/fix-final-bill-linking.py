from pathlib import Path
path = Path('apps/mobile-app/app/customer/self-managed-milestone.tsx')
text = path.read_text(encoding='utf-8')
old = "import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';"
new = "import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';"
if text.count(old) != 1:
    raise SystemExit('React Native import anchor mismatch.')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
