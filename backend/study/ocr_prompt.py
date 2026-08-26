"""The OCR prompt, in its own module so the probe script can send the
EXACT prompt the route sends without importing routes/ocr.py (which
pulls in core.db and therefore needs a live DATABASE_URL).

Probing with a different prompt than the app uses would measure
something the app never runs -- and for this prompt that is not a
technicality, see below.
"""

# LOAD-BEARING, and measured -- do not "tidy" this down to "transcribe
# this image".
#
# Benchmarked 2026-08-26: with a plain transcription prompt, EVERY
# candidate vision model scored 0/3 on vertical (tategaki) Japanese.
# They read the characters but scrambled the column order, and
# meta/llama-3.2-90b-vision-instruct replied "There is no Japanese text
# in the image. The text appears to be written in a different language,
# possibly Chinese or Korean."
#
# Adding the orientation clauses took nvidia/nemotron-nano-12b-v2-vl
# from 0/3 to 3/3 on the same image, with no loss on horizontal text.
# Manga and novels are vertical, so without this they fail silently --
# the model returns confident nonsense rather than an error.
OCR_PROMPT = (
    "Transcribe ALL Japanese text in this image exactly.\n"
    "The text may be written HORIZONTALLY (yokogaki) or VERTICALLY (tategaki).\n"
    "If it is vertical, read each column TOP to BOTTOM and order the columns "
    "RIGHT to LEFT.\n"
    "If it is horizontal, read each line LEFT to RIGHT, top to bottom.\n"
    "Output only the transcribed text, one line per line or column. "
    "No commentary, no translation.\n"
    "If there is no Japanese text, output nothing."
)

# Advisory only. OCR_PROMPT already covers both orientations, so this
# never selects a different prompt or model -- it exists so the client
# can pass along a hint the learner gave without the UI needing a mode
# toggle (see plans/024).
VERTICAL_HINT = "\nThe learner says this text is written vertically."
