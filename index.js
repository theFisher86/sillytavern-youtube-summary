import { registerSlashCommand, sendMessageAs } from "../../../slash-commands.js";
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { eventSource, event_types, saveSettingsDebounced } from "../../../../script.js";
import { amount_gen, generateRaw, updateMessageBlock } from "../../../../script.js"

// Keep track of where your extension is located, name should match repo name
const extensionName = "sillytavern-youtube-summary";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {};

const SUMMARY_TEMPLATE = "Summarize the following youtube video in a few sentences, only keep key point information, do not explain or elaborate, do not use bulletpoints";

registerSlashCommand("ytsummary", (_,link) => {
    summarize(link)
}, ["ytsum"], "Summarizes a youtube video", true, true);

registerSlashCommand("ytdiscuss", (_,link) => {
    summarize(link, true)
}, ["ytdc"], "Summarizes a youtube video and allows to ask follow-up questions", true, true);

// Loads the extension settings if they exist, otherwise initializes them to the defaults.
async function loadSettings() {
  //Create the settings if they don't exist
  extension_settings[extensionName] = extension_settings[extensionName] || {};
  if (Object.keys(extension_settings[extensionName]).length === 0) {
    Object.assign(extension_settings[extensionName], defaultSettings);
  }

  // Updating settings in the UI
  $("#custom_summarize_script").prop("checked", extension_settings[extensionName].custom_summarize_script).trigger("input");
}

// This function is called when the extension settings are changed in the UI
function onCustomSummarizeScriptInput(event) {
  const value = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].custom_summarize_script = value;
  saveSettingsDebounced();
}

function youtube_parser(url){
    const regex = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
    const match = url.match(regex);
    return (match?.length && match[1] ? match[1] : false);
}

function chunkMessage(str, length) {
    return str.match(new RegExp('.{1,' + length + '}', 'g'));
}

async function summarizeChunks(text,chunkLength) {
    const chunks = chunkMessage(Array.isArray(text) ? text.join(" ") : text,chunkLength)
    const chunkedSummary = []
    const maxChunks = 10
    for (let index = 0; index < Math.min(chunks.length,maxChunks); index++) {
        toastr.info(`Processing ${index+1} out of ${Math.min(chunks.length,maxChunks)}`)

        const chunk = chunks[index];
        const message = `${SUMMARY_TEMPLATE}:\n\n${chunk}`;
        const summary = await generateRaw(message,null,false)

        chunkedSummary.push(summary)
    }

    return chunkedSummary.join(" ")
}

async function summarize(link,post_into_chat=false) {
    if(!link) {
        toastr.warning("Please provide a youtube link to summarize")
        return
    }

    const youtube_id = youtube_parser(link);
    if(!youtube_id) {
        toastr.error("Invalid youtube link")
        return
    }

    const options = {
        method: 'POST',
        body: `{"context":{"client":{"clientName":"WEB","clientVersion":"2.9999099"}},"params":"${ btoa("\n\v" + youtube_id) }"}`
    };

    toastr.info(`Getting transcript for ${youtube_id}...`)
    
    const corsProxiedURL = 'https://corsproxy.io/?' + encodeURIComponent('https://www.youtube.com/youtubei/v1/get_transcript?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8');
    const request = await fetch(corsProxiedURL, options)
    if(request.ok) {
        const context = getContext();
        const response = await request.json()
 
        if(!response.actions) {
            toastr.error("Video not found or no transcript")
            return;
        }

        const transcriptGroups = response.actions[0].updateEngagementPanelAction.content.transcriptRenderer.body.transcriptBodyRenderer.cueGroups
        const transcript = transcriptGroups.map(transcriptGroup => transcriptGroup.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.cue.simpleText).join(" ")
        const chunkLength = context.maxContext - amount_gen;

        if(post_into_chat) sendMessageAs({name: context.name2},"[[TRANSCRIPT]]" + transcript);
        let summary = await summarizeChunks(transcript,chunkLength);

        if(summary.length > 2000) {
            toastr.info("Summary too long, summarizing again...")
            summary = await summarizeChunks(summary,chunkLength);
        }

        sendMessageAs({name: context.name2},summary);
    }else{
        // TODO: fallback to whisper streaming with yt-dlp
        toastr.error("Could not load transcript from youtube")
    }
}

function interceptMessage(messageID) {
    const message = getContext().chat[messageID];
    if( message.mes.startsWith("[[TRANSCRIPT]]")) {
        message.extra = {...message.extra,display_text: `[[[ youtube transcript ]]]`}
    }
    updateMessageBlock(messageID, message);
}

eventSource.on(event_types.MESSAGE_EDITED, interceptMessage);
eventSource.on(event_types.MESSAGE_SENT, interceptMessage);
eventSource.on(event_types.MESSAGE_RECEIVED, interceptMessage);
