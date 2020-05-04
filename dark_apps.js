#!/usr/bin/env node

const { exec } = require('child_process');
const { readFile } = require('fs');
const path = require('path');

const windowsWithDarkThemes = new Map();
const windowsClasses = new Map();
const wm_classes = [];

function getWindowIdsFromRaw(data) {
    const stringData = data.toString();
    const hexValueRegEx = /0x[a-fA-F0-9]+/g;

    const windowIds = stringData.match(hexValueRegEx);
    if (windowIds.length) {
        return windowIds;
    }

    return [];
}

function loadConfig() {
    const load = resolve => {
        const configPath = path.resolve(process.env.HOME, '.dark');
        readFile(configPath, (err, data) => {
            if (err) {
                console.error(err)
                return
            }

            data.toString().split('\n')
                .filter(s => !!s)
                .forEach(s => wm_classes.push(s));

            resolve();
        });
    }

    return new Promise(load);
}

function checkWindowClass(windowId) {
    const check = resolve => {
        const process = exec(`xprop -id ${windowId} WM_CLASS`);
        process.stdout.once('data', wmClass => {
            windowsClasses.set(windowId, wmClass)
            const hasDarkTheme = wm_classes.some(cls => wmClass.indexOf(cls) !== -1);
            resolve(hasDarkTheme);
        });
    };

    return new Promise(check);
}

function setDarkTheme(windowId) {
    windowsWithDarkThemes.set(windowId, true);
    const process = exec(`xprop -f _GTK_THEME_VARIANT 8u -set _GTK_THEME_VARIANT "dark" -id ${windowId}`);
    process.stdout.once('end', () => {
        const wmClass = windowsClasses.get(windowId);
        console.info('Dark theme set for window with id', windowId, 'and class', wmClass);
    });
}

function processData(data) {
    const windowIds = getWindowIdsFromRaw(data)
    for (const windowId of windowIds) {
        checkWindowClass(windowId)
            .then(hasDarkWindow => {
                if (hasDarkWindow && !windowsWithDarkThemes.get(windowId)) {
                    setDarkTheme(windowId);
                }
            });
    }
}

function initialCheck() {
    const process = exec('xprop -root | grep "_NET_CLIENT_LIST(WINDOW)"');
    process.stdout.once('data', data => processData(data));
}

function listenForWindows() {
    const process = exec('xprop -spy -root _NET_ACTIVE_WINDOW');
    process.stdout.on('data', data => processData(data));
}

function main() {
    loadConfig()
        .then(() => {
            initialCheck();
            listenForWindows();
        });
}

main();