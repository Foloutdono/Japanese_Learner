import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// What the store shells may ask for and must declare. Each of these was
// once wrong and cost a store review or a learner a detour: a media
// permission Google Play refuses (a photo is chosen in the system photo
// picker, android/.../PhotoChromeClient.java), a camera the WebView could
// not see, exact alarms that sent the learner to a settings screen, a
// release shipped with every class name, an iOS binary without the
// privacy manifest App Store Connect asks for.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const manifest = read('android/app/src/main/AndroidManifest.xml')

describe('the Android shell', () => {
  const permissions = [...manifest.matchAll(/<uses-permission\s+android:name="([^"]+)"(?![^>]*tools:node="remove")/g)]
    .map(([, name]) => name)

  it('asks for the network and the notifications, and nothing else', () => {
    expect(permissions.sort()).toEqual(['android.permission.INTERNET', 'android.permission.POST_NOTIFICATIONS'])
  })

  it('takes the exact-alarm permission the notifications plugin declares back out', () => {
    expect(manifest).toMatch(/android:name="android\.permission\.SCHEDULE_EXACT_ALARM"\s+tools:node="remove"/)
    const native = read('src/lib/native.js')
    const schedules = native.match(/LocalNotifications\.schedule\(/g).length
    expect(native.match(/isExactNotification: false/g)?.length).toBe(schedules)
  })

  it('chooses a photo in the photo picker and sees the camera app', () => {
    expect(read('android/app/src/main/java/app/tsuji/MainActivity.java'))
      .toContain('setWebChromeClient(new PhotoChromeClient(bridge))')
    expect(read('android/app/src/main/java/app/tsuji/PhotoChromeClient.java')).toMatch(/new PickVisualMedia\(\)/)
    expect(manifest).toMatch(/<queries>[\s\S]*android\.media\.action\.IMAGE_CAPTURE[\s\S]*<\/queries>/)
  })

  it('keeps the session out of backups and its files provider out of shared storage', () => {
    expect(manifest).toContain('android:allowBackup="false"')
    expect(read('android/app/src/main/res/xml/file_paths.xml')).not.toMatch(/<external-path\b/)
  })

  it('shrinks and renames the release code', () => {
    const release = read('android/app/build.gradle').match(/buildTypes \{\s*release \{[\s\S]*?\n {8}\}/)[0]
    expect(release).toContain('minifyEnabled true')
  })
})

describe('the iOS shell', () => {
  const project = read('ios/App/App.xcodeproj/project.pbxproj')

  it.each([
    ['App', ['App/TsujiWidgetPlugin.swift'], ['NSPrivacyAccessedAPICategoryUserDefaults', 'NSPrivacyAccessedAPICategoryFileTimestamp']],
    ['TsujiWidget', ['TsujiWidget/TsujiWidget.swift'], ['NSPrivacyAccessedAPICategoryUserDefaults']],
  ])('%s carries a privacy manifest naming the APIs it calls', (target, sources, categories) => {
    const privacy = read(`ios/App/${target}/PrivacyInfo.xcprivacy`)
    for (const source of sources) {
      if (read(`ios/App/${source}`).includes('UserDefaults')) expect(privacy).toContain('NSPrivacyAccessedAPICategoryUserDefaults')
    }
    for (const category of categories) expect(privacy).toContain(category)
    expect(privacy).toMatch(/<key>NSPrivacyTracking<\/key>\s*<false\/>/)
  })

  it('copies each manifest into its own target', () => {
    expect(project.match(/PrivacyInfo\.xcprivacy in Resources \*\/,/g)).toHaveLength(2)
  })
})
