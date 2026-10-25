import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// 写真 — the Android shell's photo intake. A photo is chosen in the system
// photo picker (android/.../PhotoChromeClient.java), which hands the app
// the one picture and needs no permission; Google Play refuses a media
// permission to an app that reads a photo now and then, and the document
// picker it replaced browsed every file on the device.
const read = path => readFileSync(new URL(`../android/app/src/main/${path}`, import.meta.url), 'utf8')

describe('the Android photo intake', () => {
  it('asks for no permission to read the media or the storage', () => {
    const permissions = [...read('AndroidManifest.xml').matchAll(/<uses-permission\s+android:name="([^"]+)"/g)]
      .map(([, name]) => name)
    expect(permissions).toContain('android.permission.CAMERA')
    expect(permissions.filter(p => /READ_MEDIA|EXTERNAL_STORAGE|MANAGE_MEDIA/.test(p))).toEqual([])
  })

  it('chooses a photo in the photo picker', () => {
    expect(read('java/app/tsuji/MainActivity.java')).toContain('setWebChromeClient(new PhotoChromeClient(bridge))')
    expect(read('java/app/tsuji/PhotoChromeClient.java')).toMatch(/new PickVisualMedia\(\)/)
  })
})
