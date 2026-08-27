#!/usr/bin/env python3
"""
Enhanced Master Builder – "The Last Days of a Carpathian God"
A Fern‑Veritasium hybrid documentary from Ceaușescu's own perspective.

Usage:
    python master_build.py [options]

Options:
    --output PATH        Final video file path (default: ./The_Last_Days...mp4)
    --base PATH          Working directory for assets (default: ./romanian_revolution_enhanced)
    --skip-images        Skip SDXL image generation if they already exist
    --device {cuda,cpu}  Force torch device; defaults to cuda if available, else cpu
    --fps N              Output frame rate (default: 30)
"""

from __future__ import annotations

import argparse
import csv
import logging
import os
import shutil
import subprocess
import sys
import textwrap
from pathlib import Path
from typing import Optional, Sequence

import numpy as np
import requests
from tqdm import tqdm

# Configure logging up front so every stage is visible.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("master_build")

# Hard dependencies. We fail fast instead of pip-installing at runtime, which
# can clobber the system environment and is inappropriate for a shared server.
REQUIRED_PACKAGES = {
    "torch": "torch",
    "diffusers": "diffusers",
    "bark": "bark",
    "scipy": "scipy",
    "moviepy": "moviepy",
    "opencv-python": "cv2",
    "transformers": "transformers",
    "accelerate": "accelerate",
    "imageio": "imageio",
    "imageio-ffmpeg": "imageio_ffmpeg",
}


def check_dependencies() -> None:
    """Verify all required packages are importable; report missing ones clearly."""
    missing: list[str] = []
    for package, import_name in REQUIRED_PACKAGES.items():
        try:
            __import__(import_name)
        except ImportError:
            missing.append(package)
    if missing:
        log.error(
            "Missing required packages: %s. Install them in your environment "
            "before running this script, e.g.: pip install %s",
            ", ".join(missing),
            " ".join(missing),
        )
        raise SystemExit(1)


# ---------------------------------------------------------------------------
# Asset paths
# ---------------------------------------------------------------------------

MUSIC_URL = "https://www.scottbuckley.com.au/library/wp-content/uploads/2020/04/The-Long-Dark.mp3"
SCRIPT = textwrap.dedent("""\
SCENE 01 [PROLOGUE – THE FALL] [whispered, cathedral reverb]
On Christmas morning 1989, a 71‑year‑old man woke up in a cold concrete room. He didn’t know it yet, but he had only three hours left to live. His name was Nicolae Ceaușescu, and for 24 years he had been the absolute master of Romania.

SCENE 02 [THE BOY FROM SCORNICEȘTI] [soft, nostalgic]
Long before the palaces and the parades, he was just a village boy, the third of ten children, a shoemaker’s apprentice who never finished school. He would walk barefoot to work and dream of something more. That hunger never left him.

SCENE 03 [THE ASCENT] [steady, proud]
In the chaos after the war, young Nicolae discovered he had a gift: he could read a room. He joined the Communist Party, and by 30 he was a rising star. Stalinism, de‑Stalinisation, it didn’t matter—Ceaușescu adapted. He learned that loyalty was fluid, and power was the only real truth.

SCENE 04 [THE CROWN] [triumphant, slow]
1965. He became General Secretary. Romania was his. He looked out from the balcony and saw a sea of hands clapping, not because they loved him, but because they had no choice. To him, it felt the same.

SCENE 05 [DEFIANCE] [bold, daring]
Then came the moment that made him a global icon. 1968: Soviet tanks rolled into Czechoslovakia, but Ceaușescu refused to join the invasion. He stood on a balcony and condemned the Warsaw Pact. The West gasped. They called him a maverick, a reformer. Nixon flew to Bucharest. The loans poured in. He started to believe he was different.

SCENE 06 [THE MIRROR CRACKS] [subdued, introspective]
But inside the country, the party was over. The secret police, the Securitate, crept into every home. Abortion and contraception were outlawed to force women to bear more children. At night, Ceaușescu would walk through the cold halls of his palace and hear nothing but the echo of his own footsteps.

SCENE 07 [THE HUNGER] [hollow, factual]
By 1981, Romania owed $10 billion. Ceaușescu made a decision that would doom millions: he would repay it all by exporting everything—food, fuel, medicine. The nation starved while he lived in a 1,000‑room palace. He told himself it was necessary. Sacrifice. He had sacrificed too.

SCENE 08 [ELENA] [intimate, cold]
His wife Elena became his most dangerous mirror. She was the only person he trusted, and she told him he was a genius. “The Genius of the Carpathians,” the propaganda called him. He began to believe it. Their love story was a prison for two, and the whole country was inside.

SCENE 09 [THE WINTER OF DELUSION] [slow, snowy]
December 1989. He was 71. He lived in a bubble of flattery, surrounded by maps that showed everything was fine. Then a pastor in a small western city refused to be silent.

SCENE 10 [TIMIȘOARA – THE SPARK] [urgent, breathless]
László Tőkés. A Hungarian Reformed pastor. The Securitate came to evict him. His parishioners surrounded the house. By evening, thousands were in the streets. Ceaușescu received the report and frowned. “Send more forces,” he said. The forces fired. People died. And instead of ending the protest, it doubled.

SCENE 11 [THE BALCONY – LIVE] [tense, crowd roar underneath]
December 21. He decided to speak to the people. From the Central Committee balcony, he looked down at 100,000 faces. He raised his hand. He expected cheers. Instead, a howl rose—a noise he had never heard. Booing. Screams. The camera caught his face: frozen, uncomprehending. The broadcast went dead for a few seconds. When it came back, the world saw a broken man.

SCENE 12 [THE FALL FROM HEAVEN] [disorienting, fast]
He felt the floor shift. Later that night, from the roof of the same building, he and Elena climbed into a helicopter. As the city shrank below, he pressed his face to the window. The streets were full of fire and flags with holes cut in the centre. The symbol of the party had been ripped out.

SCENE 13 [THE CAPTURE] [tense, whispered]
The pilot was ordered to land. Soldiers surrounded them. Ceaușescu, still wearing his heavy winter coat, tried to command them. They laughed. For the first time, his words meant nothing.

SCENE 14 [TÂRGOVIȘTE – THE KANGAROO COURT] [bare, stark]
A makeshift courtroom in a military barracks. The charges: genocide, starvation, stashing $1 billion abroad. Ceaușescu refused to recognise the court. “I will only answer to the National Assembly,” he said. Elena screamed that the soldiers were traitors. The prosecutor didn’t flinch. The trial lasted 55 minutes.

SCENE 15 [THE CORRIDOR] [heartbeat, footsteps]
They were led down a narrow corridor. Ceaușescu’s legs were weak. Elena held his arm. They passed a window, and outside the snow was still falling. He thought about the village, about the barefoot boy. Maybe he smiled. No one knows.

SCENE 16 [THE WALL] [final, slow motion]
Against a brick wall, in a courtyard. He refused a blindfold. He began to sing “The Internationale.” The soldiers opened fire. Over 100 bullets. The footage was broadcast that evening—the dictator’s death as Christmas Day entertainment.

SCENE 17 [THE EMPTY THRONE] [eerie, silent]
In the empty palace, chandeliers still glittered. The heat was still running. The food in the kitchens was still fresh. It took weeks for the people to understand that he was really gone.

SCENE 18 [THE GHOST] [reflective, whisper]
But the Securitate didn’t disappear. Many of them changed uniforms and became the new police. Romania’s revolution killed 1,100 people, but the shadow of the old regime stretched long into the new democracy.

SCENE 19 [GRAVE NUMBER 6] [close, intimate]
Today, his grave in Ghencea cemetery is a pit of weeds. On a small wooden cross, someone wrote “N. Ceaușescu – 1918‑1989” in pencil. People come not to mourn, but to confirm. They need to see it with their own eyes.

SCENE 20 [THE QUESTION] [curiosity, revealed]
Why does a dictator fall? We think it’s armies, or invasions, or coups. But Ceaușescu was destroyed by something much simpler: he forgot that the crowd is not a mirror. It’s a tide. And when the tide turns, all the propaganda in the world cannot hold it back.

SCENE 21 [RETURN TO BALCONY] [visual epilogue, no words]
(silence) The balcony is still there. Pigeons perch on the railing. The square below is just a square again. But if you stand there on a cold December night and close your eyes, you can still hear the ghost of the applause—and the roar that swallowed it.

SCENE 22 [CREDITS – MUSIC SWELL] [music]
“The Last Days of a Carpathian God” – A film created entirely by autonomous AI agents.
""")

SHOT_ROWS: list[list[str]] = [
    ["1", "image", "Cold concrete room, old man waking", "Old man waking in a bare concrete prison cell, early morning light through a high window, winter, 1989, photorealistic, haunting, film grain", "10", "sdxl"],
    ["2", "image", "Young peasant boy, barefoot, Romanian village", "Young peasant boy walking barefoot on a dusty road, Romanian countryside 1920s, golden hour, nostalgic, cinematic", "8", "sdxl"],
    ["3", "image", "Young Ceaușescu in communist meeting, shadows", "Young man in a dim communist party meeting, 1950s, cigarette smoke, intense eyes, black and white photograph, dramatic light", "7", "sdxl"],
    ["4", "image", "Ceaușescu on balcony, sea of hands, 1965", "Ceaușescu on a grand balcony, waving to a massive crowd, red flags, 1965 Bucharest, heroic angle, slightly desaturated", "9", "sdxl"],
    ["5", "image", "Ceaușescu denouncing invasion, 1968", "Ceaușescu speaking passionately on balcony, microphones, crowd cheering, 1968, historic moment, black and white, film grain", "8", "sdxl"],
    ["6", "image", "Empty palace corridor, long shadows", "Long empty corridor in a communist palace, chandeliers, cold marble, lonely figure walking away, cinematic, Kubrickian", "9", "sdxl"],
    ["7", "image", "Bare shop shelves, winter, bleak", "Empty grocery store shelves, socialist era, a sad woman waiting, cold winter light, 1980s Romania, documentary style", "7", "sdxl"],
    ["8", "image", "Ceaușescu and Elena, intimate, cold", "Nicolae and Elena Ceaușescu standing together in an ornate room, looking at each other but not touching, opulence, cold emotion, photograph", "8", "sdxl"],
    ["9", "image", "Ceaușescu alone, snow outside window", "Elderly Ceaușescu looking out a large window, snow falling, palace interior, lonely, contemplative, cinematic portrait", "9", "sdxl"],
    ["10", "image", "Crowd protecting pastor’s house, Timișoara", "Night, large crowd surrounding a small house, candles, tension, snow, 1989 Romania, photorealistic, historic", "8", "sdxl"],
    ["11", "image", "Ceaușescu on balcony, shocked, live broadcast", "Close‑up of Ceaușescu’s face, shock, microphones, crowd roar implied, 1989, iconic, emotional, film photography", "9", "sdxl"],
    ["12", "image", "Helicopter flying over Bucharest at dusk", "Aerial view of Bucharest, helicopter silhouette, smoke rising, city lights, dusk, revolution, cinematic, motion blur", "8", "sdxl"],
    ["13", "image", "Soldiers surrounding Ceaușescu, his coat", "Ceaușescu in heavy coat, surrounded by soldiers, defiant but old, night, harsh flashlight, 1989, documentary style", "7", "sdxl"],
    ["14", "image", "Kangaroo court, harsh light, Elena screaming", "Ceaușescu and Elena in a military courtroom, Elena shouting, harsh overhead light, faces in shadow, tense, 1989", "9", "sdxl"],
    ["15", "image", "Narrow corridor, two figures walking", "Long dark corridor, two elderly figures walking away from camera, backlit, snowy window, sadness, cinematic", "8", "sdxl"],
    ["16", "image", "Firing squad, wall, dawn", "Execution wall at dawn, firing squad silhouettes, snow on ground, stillness before violence, haunting, 1989", "9", "sdxl"],
    ["17", "image", "Empty palace ballroom, glittering", "Grand empty ballroom, chandeliers, no people, eerie stillness, post‑revolution, symbol of fallen power", "8", "sdxl"],
    ["18", "image", "Securitate officer burning files", "Man in trench coat burning documents in a barrel, night, fog, 1990, film noir, communist remnants", "8", "sdxl"],
    ["19", "image", "Overgrown grave, wooden cross", "Ceaușescu’s overgrown grave in Ghencea cemetery, small wooden cross with faded pencil, winter, weeds, sorrowful", "10", "sdxl"],
    ["20", "image", "Tide turning, wave crashing, metaphorical", "Powerful wave crashing against a concrete wall, metaphor, cinematic, slow shutter, dramatic sky", "7", "sdxl"],
    ["21", "image", "Empty balcony, pigeons, modern day", "The same Central Committee balcony, now empty, pigeons, modern Bucharest below, melancholic, present day", "9", "sdxl"],
    ["22", "image", "Text card: The Last Days of a Carpathian God", "Black background, elegant white serif text: 'The Last Days of a Carpathian God', credits style", "5", "text"],
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def ensure_dirs(base: Path) -> tuple[Path, Path, Path, Path]:
    voiceovers = base / "voiceovers"
    visuals = base / "visuals"
    audio = base / "audio" / "music"
    sfx = base / "audio" / "sfx"
    for d in [voiceovers, visuals, audio, sfx]:
        d.mkdir(parents=True, exist_ok=True)
    return voiceovers, visuals, audio, sfx


def download_music(audio_dir: Path, url: str = MUSIC_URL) -> Path:
    path = audio_dir / "The-Long-Dark.mp3"
    if path.exists():
        log.info("Music already downloaded: %s", path)
        return path
    log.info("Downloading music from %s", url)
    r = requests.get(url, stream=True, timeout=60)
    r.raise_for_status()
    with open(path, "wb") as f:
        for chunk in tqdm(r.iter_content(8192), desc="Music"):
            if chunk:
                f.write(chunk)
    log.info("Music saved to %s", path)
    return path


def write_script(base: Path, script_text: str = SCRIPT) -> Path:
    script_path = base / "script.txt"
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(script_text)
    log.info("Wrote script: %s", script_path)
    return script_path


def write_shot_list(base: Path, rows: Sequence[Sequence[str]] = SHOT_ROWS) -> Path:
    shot_csv = base / "shot_list.csv"
    with open(shot_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["scene", "type", "description", "prompt", "duration_sec", "ai_type"])
        writer.writerows(rows)
    log.info("Wrote shot list: %s", shot_csv)
    return shot_csv


def parse_script_segments(script_path: Path) -> list[tuple[str, str]]:
    segments: list[tuple[str, str]] = []
    current_scene = ""
    with open(script_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("SCENE"):
                current_scene = line.split()[1]
            elif line and current_scene:
                segments.append((current_scene, line))
    return segments


def build_voiceover(voiceovers: Path, segments: list[tuple[str, str]]) -> Path:
    from bark import SAMPLE_RATE, generate_audio, preload_models
    from scipy.io.wavfile import write as write_wav

    final_path = voiceovers / "narration_final.wav"
    if final_path.exists():
        log.info("Voiceover already exists: %s", final_path)
        return final_path

    log.info("Preparing Bark models...")
    preload_models()

    all_audio: list[np.ndarray] = []
    for scene_id, text in segments:
        prompt = f"[deep male voice] [slow] [reverb] {text}"
        log.info("Generating voice for scene %s", scene_id)
        audio_array = generate_audio(prompt, history_prompt="v2/en_speaker_6")
        all_audio.append(audio_array)
        all_audio.append(np.zeros(int(SAMPLE_RATE * 0.5)))

    full_audio = np.concatenate(all_audio)
    raw_path = voiceovers / "narration_raw.wav"
    write_wav(str(raw_path), SAMPLE_RATE, full_audio.astype(np.float32))

    try:
        subprocess.run(
            [
                "sox",
                str(raw_path),
                str(final_path),
                "silence",
                "1",
                "0.1",
                "0.1%",
                "gain",
                "-n",
                "-1",
                "reverb",
                "50",
                "50",
                "100",
                "0.5",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        log.info("Voiceover processed with sox: %s", final_path)
    except (FileNotFoundError, subprocess.CalledProcessError) as err:
        log.warning("sox post-processing unavailable (%s); using raw voiceover", err)
        shutil.copy(raw_path, final_path)

    return final_path


def generate_images(
    visuals: Path,
    shot_csv: Path,
    device: str,
    skip_existing: bool,
) -> None:
    import torch
    from diffusers import StableDiffusionXLPipeline

    missing: list[tuple[int, str]] = []
    with open(shot_csv, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["ai_type"] not in ("sdxl", "text"):
                continue
            scene = int(row["scene"])
            img_path = visuals / f"scene_{scene}.png"
            if skip_existing and img_path.exists():
                log.info("Skipping existing image: %s", img_path)
                continue
            missing.append((scene, row["prompt"]))

    if not missing:
        log.info("All images already generated.")
        return

    log.info("Loading Stable Diffusion XL on device '%s'...", device)
    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0",
        torch_dtype=torch.float16 if device == "cuda" else torch.float32,
        use_safetensors=True,
        variant="fp16" if device == "cuda" else None,
    )
    if device == "cuda":
        pipe = pipe.to(device)
    else:
        pipe.enable_model_cpu_offload()

    negative = "text, watermark, signature, vibrant colors, cartoon, low quality, deformed"
    for scene, prompt in missing:
        log.info("Generating image scene %d...", scene)
        img = pipe(
            prompt,
            negative_prompt=negative,
            num_inference_steps=30,
            guidance_scale=7.5,
            height=1080,
            width=1920,
        ).images[0]
        img.save(str(visuals / f"scene_{scene}.png"))


def build_manim_sequence(base: Path) -> Optional[Path]:
    manim_script = base / "manim_sequences.py"
    manim_out = base.parent / "media" / "videos" / "manim_sequences" / "1080p60" / "CeausescuTimeline.mp4"
    if manim_out.exists():
        log.info("Manim output already exists: %s", manim_out)
        return manim_out

    manim_script.write_text(textwrap.dedent("""\
    from manim import *
    class CeausescuTimeline(Scene):
        def construct(self):
            timeline = NumberLine(x_range=[1965, 1989, 2], length=12, include_numbers=True)
            timeline.to_edge(DOWN)
            self.play(Create(timeline))
            events = {1965: "Comes to power", 1971: "Cult begins", 1981: "Austerity", 1987: "Brașov revolt", 1989: "Revolution"}
            for year, text in events.items():
                dot = Dot(point=timeline.n2p(year), color=RED)
                label = Text(text, font_size=24).next_to(dot, UP)
                self.play(FadeIn(dot), Write(label))
                self.wait(0.3)
            self.play(Indicate(Dot(point=timeline.n2p(1989)), scale_factor=1.5, color=YELLOW))
            self.wait(2)
    """))

    log.info("Rendering Manim timeline...")
    try:
        subprocess.run(
            ["manim", "-pqh", str(manim_script), "CeausescuTimeline"],
            check=True,
            capture_output=True,
            text=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError) as err:
        log.error("Manim render failed: %s", err)
        return None

    if manim_out.exists():
        return manim_out
    return None


def assemble_video(
    base: Path,
    visuals: Path,
    voiceover_path: Path,
    music_path: Path,
    output_path: Path,
    fps: int,
) -> Path:
    from moviepy.editor import (
        AudioFileClip,
        ColorClip,
        CompositeAudioClip,
        CompositeVideoClip,
        ImageClip,
        VideoFileClip,
    )
    from moviepy.audio.fx import audio_loop
    import moviepy.video.fx.all as vfx

    voice = AudioFileClip(str(voiceover_path))
    total_duration = voice.duration
    log.info("Voiceover duration: %.2f seconds", total_duration)

    clips = []
    with open(base / "shot_list.csv", newline="", encoding="utf-8") as f:
        reader = list(csv.DictReader(f))

    current_time = 0.0
    manim_out = base.parent / "media" / "videos" / "manim_sequences" / "1080p60" / "CeausescuTimeline.mp4"

    for i, row in enumerate(reader):
        scene = int(row["scene"])
        duration = float(row["duration_sec"])
        img_path = visuals / f"scene_{scene}.png"
        clip: CompositeVideoClip | ImageClip | VideoFileClip | ColorClip

        if row["type"] in ("image", "text") and img_path.exists():
            clip = ImageClip(str(img_path)).set_duration(duration)
            # Subtle slow zoom; keep lambda bound to current clip to avoid leaks.
            clip = clip.resize(lambda t: 1 + 0.03 * t).set_position(("center", "center"))
        elif row["type"] == "manim" and manim_out.exists():
            clip = VideoFileClip(str(manim_out)).subclip(0, duration).resize(height=1080)
        else:
            log.warning("Missing visual for scene %d; using black frame", scene)
            clip = ColorClip((1920, 1080), color=(0, 0, 0)).set_duration(duration)

        if i > 0:
            clip = clip.set_start(current_time - 1).crossfadein(1)
        else:
            clip = clip.set_start(current_time)

        clips.append(clip)
        current_time += duration

    final = CompositeVideoClip(clips, size=(1920, 1080)).set_audio(voice)

    if music_path.exists():
        log.info("Mixing background music...")
        music = AudioFileClip(str(music_path)).volumex(0.1)
        music = audio_loop(music, duration=total_duration)
        final = final.set_audio(CompositeAudioClip([final.audio, music]))

    # Cool colour grade.
    final = final.fl_image(lambda img: (img * [0.85, 0.92, 1.08]).astype(np.uint8))

    log.info("Rendering final video to %s at %d fps, 1920x1080...", output_path, fps)
    final.write_videofile(
        str(output_path),
        fps=fps,
        codec="libx264",
        audio_codec="aac",
        threads=4,
        preset="medium",
        ffmpeg_params=["-crf", "18", "-pix_fmt", "yuv420p"],
    )

    log.info("✅ Final video delivered: %s", output_path)
    return output_path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the Carpathian God documentary video.")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("The_Last_Days_of_a_Carpathian_God_1080p.mp4"),
        help="Final video output path (default: ./The_Last_Days_of_a_Carpathian_God_1080p.mp4)",
    )
    parser.add_argument(
        "--base",
        type=Path,
        default=Path("romanian_revolution_enhanced"),
        help="Working directory for generated assets (default: ./romanian_revolution_enhanced)",
    )
    parser.add_argument(
        "--skip-images",
        action="store_true",
        help="Skip SDXL image generation for existing scene images",
    )
    parser.add_argument(
        "--device",
        choices=["cuda", "cpu"],
        default=None,
        help="Torch device override; defaults to cuda if available",
    )
    parser.add_argument(
        "--fps",
        type=int,
        default=30,
        help="Output frame rate (default: 30)",
    )
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)

    check_dependencies()

    import torch

    device = args.device or ("cuda" if torch.cuda.is_available() else "cpu")
    if device == "cuda" and not torch.cuda.is_available():
        log.warning("CUDA requested but unavailable; falling back to CPU offload.")
        device = "cpu"
    log.info("Using torch device: %s", device)

    base = args.base.resolve()
    voiceovers, visuals, audio, _sfx = ensure_dirs(base)

    music_path = download_music(audio)
    script_path = write_script(base)
    shot_csv = write_shot_list(base)

    segments = parse_script_segments(script_path)
    voiceover_path = build_voiceover(voiceovers, segments)

    generate_images(visuals, shot_csv, device, args.skip_images)
    build_manim_sequence(base)

    output = args.output.resolve()
    assemble_video(base, visuals, voiceover_path, music_path, output, args.fps)
    return 0


if __name__ == "__main__":
    sys.exit(main())
