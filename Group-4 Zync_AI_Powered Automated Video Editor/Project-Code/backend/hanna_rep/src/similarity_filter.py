from sentence_transformers import SentenceTransformer, util
from config import EMBED_MODEL, SIMILARITY_THRESHOLD, TOP_K_PER_CLIP, EXCLUDE_THRESHOLD
from db_reader import get_all_descriptions_for_video
import json
import numpy as np


class SimilarityFilter:
    def __init__(self, model_name=EMBED_MODEL, threshold=SIMILARITY_THRESHOLD):
        self.model = SentenceTransformer(model_name)
        self.threshold = threshold
        self.exclude_threshold = EXCLUDE_THRESHOLD

    def split_prompt(self, prompt: str):
        """Split prompt into semantic clauses using | or ; delimiters"""
        if " | " in prompt:
            clauses = [c.strip() for c in prompt.split("|") if c.strip()]
            return clauses if clauses else [prompt.strip()]
        elif ";" in prompt:
            clauses = [c.strip() for c in prompt.split(";") if c.strip()]
            return clauses if clauses else [prompt.strip()]
        else:
            return [prompt.strip()]

    def score_and_select(
        self,
        video_stem,
        user_prompt,
        match_mode="any",
        exclude_prompt=None,
        exclude_frame_ranges=None,
    ):
        """
        Select complete clips based on semantic similarity.
        Returns the TOP 2 best-matching clips with ALL their frames from START to END of each clip_id.
        ONLY processes frames from the specified video_stem.
        """
        rows = get_all_descriptions_for_video(video_stem)
        if not rows:
            print(f"❌ No descriptions found for video_stem={video_stem}")
            return []

        print(f"📊 Found {len(rows)} total frames for video '{video_stem}'")

        # ✅ Filter by video_stem & collect valid frames
        valid_rows = []
        video_clip_ids = set()
        for row in rows:
            video_name, frame_index, frame_path, desc, clip_id = row
            if not video_name.startswith(video_stem):
                print(f"⚠️ Skipping frame from wrong video: {video_name}")
                continue
            if not desc or not clip_id or not frame_path:
                print(f"⚠️ Skipping frame {frame_index} - incomplete metadata")
                continue
            valid_rows.append(row)
            video_clip_ids.add(clip_id)

        if not valid_rows:
            print(f"❌ No valid frames after filtering for video '{video_stem}'")
            return []

        print(f"✅ {len(valid_rows)} frames passed validation for video '{video_stem}'")

        # Encode descriptions
        descriptions = [row[3] for row in valid_rows]
        desc_embs = self.model.encode(descriptions, convert_to_tensor=True)

        # Encode user prompt clauses
        clauses = self.split_prompt(user_prompt)
        print(f"🔍 Processing {len(clauses)} include clause(s): {clauses}")
        clause_embs = self.model.encode(clauses, convert_to_tensor=True)
        sim_matrix = util.cos_sim(clause_embs, desc_embs).cpu().numpy()

        # Encode exclude prompt if given
        exclude_matrix = None
        if exclude_prompt:
            exclude_clauses = self.split_prompt(exclude_prompt)
            print(f"🚫 Processing {len(exclude_clauses)} exclude clause(s): {exclude_clauses}")
            exclude_embs = self.model.encode(exclude_clauses, convert_to_tensor=True)
            exclude_matrix = util.cos_sim(exclude_embs, desc_embs).cpu().numpy()

        # ✅ Score each clip
        clip_scores = {}  # {clip_id: (max_score, best_frame_index, best_clause)}
        excluded_clip_ids = set()

        for i, row in enumerate(valid_rows):
            video_name, frame_index, frame_path, desc, clip_id = row

            # Skip frames from excluded clip_ids
            if clip_id in excluded_clip_ids:
                continue

            # Frame range exclusions
            if exclude_frame_ranges:
                for start_frame, end_frame in exclude_frame_ranges:
                    if start_frame <= frame_index <= end_frame:
                        print(f"  🚫 Frame {frame_index} (clip {clip_id}) excluded by range [{start_frame}-{end_frame}]")
                        excluded_clip_ids.add(clip_id)
                        break
            if clip_id in excluded_clip_ids:
                continue

            # Semantic exclusion
            if exclude_matrix is not None:
                exclude_score = exclude_matrix[:, i].max()
                if exclude_score >= 0.35:
                    print(f"  ⛔ Clip {clip_id} excluded (frame {frame_index} matched exclusion with score {exclude_score:.3f})")
                    excluded_clip_ids.add(clip_id)
                    continue

            # Track best score per clip
            max_score = sim_matrix[:, i].max()
            if max_score >= self.threshold:
                best_clause_idx = sim_matrix[:, i].argmax()
                if clip_id not in clip_scores or max_score > clip_scores[clip_id][0]:
                    clip_scores[clip_id] = (max_score, frame_index, clauses[best_clause_idx])

        if not clip_scores:
            print(f"❌ No clips matched (threshold: {self.threshold})")
            return []

        # ✅ Select TOP 2 clips by score
        sorted_clips = sorted(clip_scores.items(), key=lambda x: x[1][0], reverse=True)
        top_clips = sorted_clips[:2]

        print(f"\n📊 Top {len(top_clips)} clip(s) selected:")
        for clip_id, (score, frame_idx, clause) in top_clips:
            print(f"   - Clip {clip_id}: score {score:.3f} (matched '{clause}' at frame {frame_idx})")

        selected_clip_ids = {clip_id for clip_id, _ in top_clips}

        # ✅ Find frame ranges of selected clips
        clip_frame_ranges = {}
        for row in valid_rows:
            _, frame_index, _, _, clip_id = row
            if clip_id in selected_clip_ids:
                if clip_id not in clip_frame_ranges:
                    clip_frame_ranges[clip_id] = (frame_index, frame_index)
                else:
                    min_f, max_f = clip_frame_ranges[clip_id]
                    clip_frame_ranges[clip_id] = (min(min_f, frame_index), max(max_f, frame_index))

        print(f"\n📏 Clip frame ranges:")
        for clip_id, (min_f, max_f) in sorted(clip_frame_ranges.items()):
            print(f"   - Clip {clip_id}: frames {min_f} to {max_f}")

        # ✅ Collect all frames from selected clips
        selected_clip_ids = {clip_id for clip_id, _ in top_clips}
        selected = []
        for i, row in enumerate(valid_rows):
            video_name, frame_index, frame_path, desc, clip_id = row
            if clip_id in selected_clip_ids:
                max_score = sim_matrix[:, i].max()
                best_clause_idx = sim_matrix[:, i].argmax()
                selected.append({
            "video_name": video_name,
            "frame_index": frame_index,
            "image_path": frame_path,
            "clip_id": clip_id,
            "score": float(max_score),
            "matched_clause": clauses[best_clause_idx],
            "clause_index": int(best_clause_idx)
        })
        # Debug output
        frames_by_clip = {}
        for item in selected:
            frames_by_clip.setdefault(item["clip_id"], []).append(item["frame_index"])

        print(f"\n✅ Selected {len(selected)} frames from {len(frames_by_clip)} clip(s):")
        for cid, frames in sorted(frames_by_clip.items()):
            frames_sorted = sorted(frames)
            print(f"   - Clip {cid}: {len(frames)} frames → {frames_sorted[0]} to {frames_sorted[-1]}")

        return sorted(selected, key=lambda x: (x["clip_id"], x["frame_index"]))

    def save_output(self, selected, output_path="selected_clips.json"):
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(selected, f, indent=2)
        print(f"💾 Output saved to {output_path}")
        return output_path