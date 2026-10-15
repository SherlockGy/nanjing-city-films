#!/usr/bin/env python3
"""用 codex 图生图把真实照片描成与全片一致的铜版雕刻线稿（主体孤立在白底上），保证造型准确。"""
import subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
D = Path(__file__).resolve().parents[1] / 'data/refs'
JOBS = {
  'statue': ('the bronze standing statue of Dr. Sun Yat-sen (long overcoat, holding a walking cane) together with its tall stone pedestal', 'portrait'),
  'zifeng': ('the Zifeng Tower skyscraper (Greenland Square Zifeng Tower) including its spire, the whole tower from base to tip', 'portrait'),
  'njnan': ('the Nanjing South Railway Station building with its huge overhanging roof, colonnade, and the front plaza steps', 'landscape'),
}
def run(k):
    subj, orient = JOBS[k]; out = D / f'eng_{k}.png'
    if out.exists() and '--force' not in sys.argv: return k, 'skip'
    task = (f"Use your built-in image generation tool in EDIT mode with the attached photo as the input image. Redraw ONLY {subj} as a precise antique "
            f"copperplate engraving / architectural technical illustration: crisp dark sepia-black ink contour lines, fine parallel hatching and cross-hatching for shading, "
            f"no color fills. Keep EXACTLY the proportions, pose, silhouette and details of the subject as in the photo. Remove everything else (sky, clouds, other buildings, "
            f"trees, cars, traffic lights, people, signs): the subject must be isolated on a pure flat white background. No text, no border, no frame, no signature. "
            f"{orient.capitalize()} orientation. Save the result in the current directory as eng_{k}.png (overwrite). Do nothing else, do not ask questions.")
    for _ in range(3):
        subprocess.run(['codex', 'exec', '--skip-git-repo-check', '-C', str(D), '--sandbox', 'workspace-write', '-c', 'model_reasoning_effort="low"', task, '-i', f'src_{k}.jpg'],
                       stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=900)
        if out.exists(): return k, 'ok'
    return k, 'FAIL'
with ThreadPoolExecutor(3) as ex:
    for k, st in ex.map(run, [a for a in sys.argv[1:] if not a.startswith('--')] or list(JOBS)): print(k, st, flush=True)
