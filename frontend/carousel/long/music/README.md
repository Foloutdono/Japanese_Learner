# Recorded music for the videos (plan 219b)

The long videos and the shorts play a bed under the voice. By default it
is played by `backend/scripts/long_video_audio.py` itself (`--music trio`
or `--music lofi`, plan 219), and the video owes no one for it. A
recorded track can take its place:

```bash
cd frontend
VOICEVOX_URL=http://localhost:50121 node carousel/long/render.mjs --kind vocab --level N5 --music carousel/long/music/some-track.mp3
```

The track is played again from its start until the video ends (a
two-second crossfade over the seam), brought to the generated bed's
level, faded in and out, and stepped back while a line is said, as the
generated bed is.

## A track is used only with its licence written down

Beside each track, under the same name, a `.json` file says where it
came from and how it may be used. The renderer refuses a track without
one, or with any of these fields empty:

```json
{
  "title": "The track's title",
  "artist": "Its artist",
  "licence": "CC BY 4.0",
  "source": "https://the page it was downloaded from",
  "credit": "“The track's title” by Its artist, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)"
}
```

`credit` is printed in the video's description, after the voices'
credit, on YouTube and in a short's caption: write it as the licence asks
for it. The audio file is never committed (some licences forbid passing
the file on); the `.json` is, so the track can be fetched again from
`source`.

## Which tracks

Only a licence that allows the use, in writing, for every place the
videos go (YouTube, monetised, and the short-video feeds):

- **CC0 / public domain**: no condition.
- **CC BY**: free with the credit the licence asks for, which `credit` is.
- **A site's own licence** (Pixabay's, the YouTube Audio Library's…):
  only when it allows use in monetised videos on every platform the
  video goes to. Read it per track; some tracks are registered with
  Content ID and get a claim anyway.

Never:

- **TikTok's, Instagram's or YouTube Shorts' in-app sounds.** They are
  licensed for use inside that app only. To put a trending sound on a
  short, add it in the app when posting, over a video rendered with the
  generated bed or none.
- **A "no copyright" upload on YouTube or a rip from anywhere**: the
  uploader cannot give a licence they do not hold.
- **NC (non-commercial) or ND (no derivatives) Creative Commons
  licences**: the channel promotes an app, and a loop cut to a video's
  length is a derivative.
