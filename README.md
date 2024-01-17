### youtube summary extension

a silly tavern extension that can summarize youtube videos, regardless of context length of currently loaded model; though ideally a minimum of 1024 or 2048 context length, otherwise the summarized chunks might become incoherent.

---

slash commands available:

- `/ytdiscuss <link>` alias `/ytdc <link>` - adds the transcript into chat, so you can ask follow-up questions similar to claude
- `/ytsummary <link>` alias `/ytsum <link>` - only adds the summary to chat

where `<link>`-placeholder is just the youtube video link with no brackets.

models tested that work well:
- https://huggingface.co/SanjiWatsuki/Kunoichi-7B (very good small model)
- https://huggingface.co/xDAN-AI/xDAN-L1-Chat-RL-v1 (alternative to kunoichi but works just as well)
- https://huggingface.co/mistralai/Mixtral-8x7B-Instruct-v0.1 (requires significant amount of vram)