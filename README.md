# Minecraft Translating Helper(In VSCode)

Helps you translating minecraft text at vs code.
y
This project is make as vive coding.

## Description

### Adding Simbols

You can input simbol(§) latter by followed steps.

1. Press "&&"
2. It will show auto-complete for some ex(like color, bold, etc...)
3. Use arrow key or mouse for select, and enter for add that into text.

Simbol will makes text as colored or effected like in minecraft at editor.

### Text Veiwer

Select text which text want to test and press "Ctrl + Shift + L" at same time.

It will create new window at you editor named as "Minecraft Preview", which can change background color

This feature is for test text color more precesely.

### Scroll Sync

Press "Alt + S" to turn on scroll sync.

This will makes you sync the scroll with split viewed window.

Note: This function may can broken when both files total lines are diffrent.

### Create new files

This function provides you create you file with full key with no value for starting new translating.

Press "F1"(or "Ctrl + Shift + P) and select "Minecrate: Create New Language File(Empty Values)", and add file name.

### Providing errors for json

This extention provides 3 types of errors for json.

1. Warn when value isn't translated(empty)
2. Error when target file contains missing key(key not in original json)
3. Error when original file contains new key(key not in target json)

3rd one is kinda weird, so you need to re-open both(original and target json) json to reload.
