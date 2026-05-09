import streamlit as st
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timezone
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from vocabulary import (
    DOMAINS, EMOTIONS, REGISTERS, PHRASE_TYPES,
    CEFR_LEVELS, REGIONS, ERAS, SUPPORTED_LANGUAGES, LANGUAGE_NAMES,
)
from config import Config

st.set_page_config(page_title="Flashcards QA", layout="wide", page_icon="🃏")

# ── DB ──────────────────────────────────────────────────────────────────────

@st.cache_resource
def get_db():
    cfg = Config()
    client = MongoClient(cfg.mongodb_uri)
    return client[cfg.db_name]

db = get_db()

def load_reels(status_filter=None, source_filter=None, domain_filter=None, no_speaker=False):
    q = {}
    if status_filter and status_filter != "all":
        q["status"] = status_filter
    if source_filter and source_filter != "all":
        q["source.show"] = source_filter
    if domain_filter and domain_filter != "all":
        q["tags.domains"] = domain_filter
    if no_speaker:
        q["speaker"] = None
    return list(db.reels.find(q).sort("created_at", -1))

def load_reel(reel_id):
    return db.reels.find_one({"_id": ObjectId(reel_id)})

def save_reel(reel_id, updates):
    updates["updated_at"] = datetime.now(timezone.utc)
    db.reels.update_one({"_id": ObjectId(reel_id)}, {"$set": updates})

def set_status(reel_id, status):
    db.reels.update_one(
        {"_id": ObjectId(reel_id)},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}},
    )

def bulk_publish(reel_ids):
    db.reels.update_many(
        {"_id": {"$in": [ObjectId(i) for i in reel_ids]}},
        {"$set": {"status": "published", "updated_at": datetime.now(timezone.utc)}},
    )

# ── Session state defaults ───────────────────────────────────────────────────

if "view" not in st.session_state:
    st.session_state.view = "list"
if "current_id" not in st.session_state:
    st.session_state.current_id = None
if "selected" not in st.session_state:
    st.session_state.selected = set()

# ── Sidebar ──────────────────────────────────────────────────────────────────

with st.sidebar:
    st.title("🃏 Flashcards QA")

    total = db.reels.count_documents({})
    pending = db.reels.count_documents({"status": "pending"})
    published = db.reels.count_documents({"status": "published"})
    rejected = db.reels.count_documents({"status": "rejected"})

    st.metric("Total", total)
    col1, col2, col3 = st.columns(3)
    col1.metric("Pending", pending)
    col2.metric("Published", published)
    col3.metric("Rejected", rejected)

    st.divider()
    st.subheader("Filters")

    sources = ["all"] + db.reels.distinct("source.show")
    filter_source = st.selectbox("Source", sources)

    filter_status = st.selectbox("Status", ["pending", "published", "rejected", "all"])

    top_domains = ["all"] + sorted(set(d.split(".")[0] for d in DOMAINS))
    filter_domain = st.selectbox("Domain", top_domains)

    filter_no_speaker = st.checkbox("Без персонажа")

    if st.button("↩ Back to list", use_container_width=True):
        st.session_state.view = "list"
        st.session_state.current_id = None
        st.rerun()

# ── Helper: episode label ────────────────────────────────────────────────────

def episode_label(source):
    s = source.get("season")
    e = source.get("episode")
    show = source.get("show", "")
    if s and e:
        return f"{show} S{s:02d}E{e:02d}"
    return show

# ── LIST VIEW ────────────────────────────────────────────────────────────────

if st.session_state.view == "list":
    reels = load_reels(filter_status, filter_source, filter_domain if filter_domain != "all" else None, filter_no_speaker)

    st.subheader(f"Reels — {len(reels)} found")

    if not reels:
        st.info("No reels match the current filters.")
        st.stop()

    all_ids = [str(r["_id"]) for r in reels]

    # Bulk actions bar
    c1, c2, c3, c4 = st.columns([2, 1.5, 1.5, 1.5])
    all_selected = len(st.session_state.selected) == len(all_ids) and len(all_ids) > 0
    select_all = c1.checkbox(
        f"Выбрать все ({len(all_ids)})",
        value=all_selected,
    )
    if select_all:
        st.session_state.selected = set(all_ids)
    elif all_selected:
        st.session_state.selected = set()

    if st.session_state.selected:
        label = f"✅ Опубликовать ({len(st.session_state.selected)})"
        if c2.button(label, use_container_width=True):
            bulk_publish(list(st.session_state.selected))
            st.session_state.selected = set()
            st.rerun()
        label2 = f"❌ Отклонить ({len(st.session_state.selected)})"
        if c3.button(label2, use_container_width=True):
            for rid in st.session_state.selected:
                set_status(rid, "rejected")
            st.session_state.selected = set()
            st.rerun()

    st.divider()

    # Table header
    hcols = st.columns([0.5, 3.5, 1.5, 2, 1, 2, 1.5, 1.5])
    for col, label in zip(hcols, ["", "Quote", "Speaker", "Source", "CEFR", "Domains", "Status", "Actions"]):
        col.markdown(f"**{label}**")
    st.divider()

    for reel in reels:
        rid = str(reel["_id"])
        cols = st.columns([0.5, 3.5, 1.5, 2, 1, 2, 1.5, 1.5])

        checked = cols[0].checkbox("", key=f"chk_{rid}", value=rid in st.session_state.selected, label_visibility="collapsed")
        if checked:
            st.session_state.selected.add(rid)
        else:
            st.session_state.selected.discard(rid)

        quote_short = reel.get("quote_en", "")[:80] + ("…" if len(reel.get("quote_en", "")) > 80 else "")
        cols[1].write(quote_short)

        speaker = reel.get("speaker")
        cols[2].markdown(f"`{speaker}`" if speaker else "❓")

        cols[3].write(episode_label(reel.get("source", {})))
        cols[4].write(reel.get("tags", {}).get("cefr", "—"))
        domains = reel.get("tags", {}).get("domains", [])
        cols[5].write(", ".join(domains[:2]))

        status = reel.get("status", "pending")
        status_badge = {"pending": "🟡 pending", "published": "🟢 published", "rejected": "🔴 rejected"}.get(status, status)
        cols[6].write(status_badge)

        with cols[7]:
            bc1, bc2 = st.columns(2)
            if bc1.button("View", key=f"view_{rid}", use_container_width=True):
                st.session_state.current_id = rid
                st.session_state.view = "detail"
                st.rerun()
            if status == "pending":
                if bc2.button("✅", key=f"pub_{rid}", use_container_width=True):
                    set_status(rid, "published")
                    st.rerun()
            elif status == "published":
                if bc2.button("❌", key=f"rej_{rid}", use_container_width=True):
                    set_status(rid, "rejected")
                    st.rerun()

# ── DETAIL VIEW ──────────────────────────────────────────────────────────────

elif st.session_state.view == "detail" and st.session_state.current_id:
    reel = load_reel(st.session_state.current_id)
    if not reel:
        st.error("Reel not found.")
        st.stop()

    rid = str(reel["_id"])
    tags = reel.get("tags", {})
    locales = reel.get("locales", {})
    expressions = reel.get("expressions", [])
    words = reel.get("words", [])

    # Header
    st.markdown(f"### {episode_label(reel.get('source', {}))}")
    status = reel.get("status", "pending")
    speaker = reel.get("speaker")
    speaker_certain = reel.get("speaker_certain", True)
    if speaker:
        st.markdown(f"**Speaker:** `{speaker}`" + (" *(uncertain)*" if not speaker_certain else ""))
    else:
        st.warning("Speaker неизвестен")
    st.markdown(f"**Status:** `{status}`")

    # Action buttons
    ac1, ac2, ac3, _ = st.columns([1, 1, 1, 5])
    publish_clicked = ac1.button("✅ Publish", use_container_width=True, disabled=status == "published")
    reject_clicked = ac2.button("❌ Reject", use_container_width=True, disabled=status == "rejected")
    save_clicked = ac3.button("💾 Save edits", use_container_width=True)

    st.divider()

    # Quote
    st.markdown("**English quote**")
    new_quote = st.text_area("quote_en", value=reel.get("quote_en", ""), height=80, label_visibility="collapsed")

    # Tags
    st.markdown("**Tags**")
    t1, t2, t3, t4, t5, t6, t7 = st.columns(7)
    valid_domains = [d for d in tags.get("domains", []) if d in DOMAINS]
    new_domains = t1.multiselect("Domains", DOMAINS, default=valid_domains)
    new_emotion = t2.selectbox("Emotion", EMOTIONS, index=EMOTIONS.index(tags["emotion"]) if tags.get("emotion") in EMOTIONS else 0)
    new_register = t3.selectbox("Register", REGISTERS, index=REGISTERS.index(tags["register"]) if tags.get("register") in REGISTERS else 0)
    new_type = t4.selectbox("Type", PHRASE_TYPES, index=PHRASE_TYPES.index(tags["type"]) if tags.get("type") in PHRASE_TYPES else 0)
    new_cefr = t5.selectbox("CEFR", CEFR_LEVELS, index=CEFR_LEVELS.index(tags["cefr"]) if tags.get("cefr") in CEFR_LEVELS else 0)
    new_region = t6.selectbox("Region", REGIONS, index=REGIONS.index(tags["region"]) if tags.get("region") in REGIONS else 0)
    new_era = t7.selectbox("Era", ERAS, index=ERAS.index(tags["era"]) if tags.get("era") in ERAS else 0)

    new_social_risk = st.checkbox("Social risk", value=reel.get("social_risk", False))
    new_adult = st.checkbox("Adult content", value=reel.get("adult", False))

    st.divider()

    # Language tabs
    available_langs = [l for l in SUPPORTED_LANGUAGES if l in locales] or SUPPORTED_LANGUAGES[:1]
    lang_tabs = st.tabs([f"{LANGUAGE_NAMES[l]} ({l.upper()})" for l in available_langs])

    new_locales = {}
    for tab, lang in zip(lang_tabs, available_langs):
        with tab:
            locale_data = locales.get(lang, {})
            lc1, lc2 = st.columns(2)
            new_context = lc1.text_area(f"Context ({lang})", value=locale_data.get("context", ""), height=100, key=f"ctx_{lang}")
            new_quote_loc = lc2.text_area(f"Quote translation ({lang})", value=locale_data.get("quote", ""), height=100, key=f"qt_{lang}")
            new_locales[lang] = {"context": new_context, "quote": new_quote_loc}

    st.divider()

    # Expressions
    st.markdown("**Expressions**")
    new_expressions = []
    for ei, expr in enumerate(expressions):
        with st.expander(f"Expression {ei+1}: {expr.get('phrase', '')}", expanded=ei == 0):
            new_phrase = st.text_input("Phrase", value=expr.get("phrase", ""), key=f"ep_{ei}")
            expr_locales = expr.get("locales", {})
            new_expr_locales = {}
            el_langs = [l for l in SUPPORTED_LANGUAGES if l in expr_locales] or list(expr_locales.keys())
            if el_langs:
                etabs = st.tabs([l.upper() for l in el_langs])
                for etab, elang in zip(etabs, el_langs):
                    with etab:
                        eldata = expr_locales.get(elang, {})
                        ec1, ec2 = st.columns(2)
                        new_lit = ec1.text_input("Literal", value=eldata.get("literal", ""), key=f"el_{ei}_{elang}_lit")
                        new_exp = ec2.text_area("Explanation", value=eldata.get("explanation", ""), height=80, key=f"el_{ei}_{elang}_exp")
                        new_expr_locales[elang] = {"literal": new_lit, "explanation": new_exp}
            new_expressions.append({"phrase": new_phrase, "locales": new_expr_locales})

    st.divider()

    # Words
    st.markdown("**Words**")
    new_words = []
    if words:
        for wi, word in enumerate(words):
            with st.expander(f"Word {wi+1}: {word.get('word', '')} — {word.get('level', '')}", expanded=False):
                wc1, wc2 = st.columns([2, 1])
                new_word_str = wc1.text_input("Word", value=word.get("word", ""), key=f"w_{wi}_word")
                new_level = wc2.selectbox("Level", CEFR_LEVELS, index=CEFR_LEVELS.index(word["level"]) if word.get("level") in CEFR_LEVELS else 0, key=f"w_{wi}_lvl")
                word_locales = word.get("locales", {})
                new_word_locales = {}
                wl_langs = [l for l in SUPPORTED_LANGUAGES if l in word_locales] or list(word_locales.keys())
                if wl_langs:
                    wl_tabs = st.tabs([l.upper() for l in wl_langs])
                    for wltab, wlang in zip(wl_tabs, wl_langs):
                        with wltab:
                            wldata = word_locales.get(wlang, {})
                            new_trans = st.text_input("Translation", value=wldata.get("translation", ""), key=f"wt_{wi}_{wlang}")
                            new_word_locales[wlang] = {"translation": new_trans}
                new_words.append({"word": new_word_str, "level": new_level, "locales": new_word_locales})
    else:
        st.info("No words extracted for this reel.")

    # ── Apply actions ────────────────────────────────────────────────────────

    def collect_updates():
        return {
            "quote_en": new_quote,
            "tags": {
                "domains": new_domains,
                "emotion": new_emotion,
                "register": new_register,
                "type": new_type,
                "cefr": new_cefr,
                "region": new_region,
                "era": new_era,
            },
            "locales": new_locales,
            "expressions": new_expressions,
            "words": new_words,
            "social_risk": new_social_risk,
            "adult": new_adult,
        }

    if save_clicked:
        save_reel(rid, collect_updates())
        st.success("Saved.")

    if publish_clicked:
        updates = collect_updates()
        updates["status"] = "published"
        save_reel(rid, updates)
        st.success("Published!")
        st.session_state.view = "list"
        st.rerun()

    if reject_clicked:
        set_status(rid, "rejected")
        st.session_state.view = "list"
        st.rerun()
