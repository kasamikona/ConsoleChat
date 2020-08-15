/* RECENT CHANGES (internal use) - v1.2.3 to v1.2.4
*/

var readline = require('readline');

var consoleMsgChannel;
var mainInput;
var mainInputSuspended = true;
var lastInputHistory; // hacky method for maintaining history, may break if readline updates
var lastCursorPos;
var lastDisplayedUserId = null;
var lastMessage = null;
var lastInputHeight;

var ignoreBots = false;
var useTimestamps = true;
var useBotBadges = true;
var stopFunction = process.exit;
var promptPrefix = "> ";
var gamma = 1.2;

var client;

const versionString = "v1.2.3";

module.exports.setIgnoreBots = (ignore = true) => {ignoreBots = ignore;};
module.exports.setUseTimestamps = (use = true) => {useTimestamps = use;};
module.exports.setUseBotBadges = (use = true) => {useBotBadges = use;};
module.exports.setStopFunction = (f = process.exit) => {stopFunction = f;};
module.exports.setPromptPrefix = (p = "> ") => {promptPrefix = p;};

function setChannel(channel) {
    consoleMsgChannel = channel;
    lastDisplayedUserId = null;
    //lastMessage = null;
}
module.exports.setChannel = setChannel;

module.exports.onMessage = (message) => {
    if(!consoleMsgChannel) return;
    if(message.channel.id != consoleMsgChannel.id) return;
    if(!(message.author.bot && ignoreBots)){
        saveHomeCursor();
        outputMessageMember(message.member);
        outputMessageCleanContent(message.cleanContent);
        message.attachments.forEach((file) => {
            outputMessageSpecial("File", file.url);
        });
        message.embeds.forEach((embed) => {
            outputMessageSpecial("Embed", embed.title);
        });
        restoreCursor();
    }
};

module.exports.hidePrompt = () => {
    saveHomeCursor();
};

module.exports.showPrompt = () => {
    restoreCursor();
};

module.exports.println = (message) => {
    saveHomeCursor();
    console.log(message);
    restoreCursor();
};

module.exports.setGamma = (gammaIn) => {
    gamma = gammaIn;
}

function outputMessageMember(member) {
    if(lastDisplayedUserId != member.user.id){
        var timeString = "";
        if(useTimestamps) timeString += " (" + ((new Date()).toTimeString().substring(0, 8)) + ")";
        var badgeString = "";
        if(useBotBadges && member.user.bot) badgeString = consoleBotBadge();
        var newUserString = `\n${consoleColorForMember(member)}${member.displayName}${consoleColorReset()}${badgeString}${timeString}:`;
        console.log(newUserString);
        lastDisplayedUserId = member.user.id;
    }
}

function outputMessageSpecial(type, detail){
    var detailWithColon = detail ? (": " + detail) : "";
    console.log(`${consoleColor(0)} -> ${type}${detailWithColon} ${consoleColorReset()}`);
}

function outputMessageDelete(){
    outputMessageSpecial("Deleted previous message");
}

function outputMessageCleanContent(cleanContent) {
    if(cleanContent && cleanContent.trim().length > 0) console.log(cleanContent);
}

function sendMessage(inputLine) {
    if(!consoleMsgChannel) return;
    erasePreviousLinesForInput(inputLine);
    consoleMsgChannel.send(inputLine).then(message => lastMessage = message).catch(() => {
        lastMessage = null;
        saveHomeCursor();
        console.log(`\n\x1b[0;1;31mFailed to send message:\n${inputLine}${consoleColorReset()}`);
        restoreCursor();
    });
}

function erasePreviousLinesForInput(input) {
    readline.cursorTo(process.stdout, 0);
    readline.moveCursor(process.stdout, 0, -lastInputHeight);
    readline.clearScreenDown(process.stdout);
}

function consoleBotBadge(){
    return " \x1b[0;1;37;44m" + // Reset and 4bit
    "\x1b[38;5;15;48;5;62m" + // 8bit
    //"\x1b[38:2:255:255:255m" + // 24bit FG
    //"\x1b[48:2:95:95:215m" + // 24bit BG
    "BOT" + // Text
    consoleColorReset(); // Standard reset
}

function consoleColorForMember(member){
    var c = member.displayColor;
    if(!c || c <= 0) c = 16777215;
    return consoleColor(c);
}

function consoleColor(color = 16777215){
    var rgb = [
        Math.pow(((color >> 16) & 255) / 255, gamma) * 255,
        Math.pow(((color >> 8) & 255) / 255, gamma) * 255,
        Math.pow((color & 255) / 255, gamma) * 255
    ];
    // Calculate 4bit approximation
    var minDiff = 1000;
    var minDiffIndex = -1;
    for(var i = 0; i < 16; i++){
        var intensity = (i & 8) * 10.625;
        var rgbDiff = [
            ((i & 1) * 170) + intensity - rgb[0],
            ((i & 2) * 85) + intensity - rgb[1],
            ((i & 4) * 42.5) + intensity - rgb[2]
        ];
        var paletteDiff = Math.abs(rgbDiff[0]) + Math.abs(rgbDiff[1]) + Math.abs(rgbDiff[2]);
        if(paletteDiff < minDiff) {
            minDiff = paletteDiff;
            minDiffIndex = i;
        }
    }
    // Add 4bit approximation and enable invert if too dark (widely supported)
    var returnValue = "\x1b[" + ((minDiffIndex == 0) ? "0;1;7" : (((minDiffIndex >= 8) ? "1;3" : "0;3") + (minDiffIndex & 7))) + "m";
    // Set colors for dark text
    var cf8 = 16 + (36 * Math.round(rgb[0] / 51)) + (6 * Math.round(rgb[1] / 51)) + Math.round(rgb[2] / 51);
    var cb8 = 0;
    var cf24 = rgb;
    var cb24 = [0, 0, 0];
    if(minDiffIndex == 0){ // Dark, foreground/background already inverted in 4bit command
        cb8 = cf8;
        cf8 = 15;
        cb24 = cf24;
        cf24 = [255, 255, 255];
    }
    // Add 8bit approximation (often supported)
    returnValue += "\x1b[38;5;" + cf8 + ";48;5;" + cb8 + "m";
    // Add 24bit true color (rarely supported)
    //returnValue += "\x1b[38;2;" + cf24[0] + "," + cf24[1] + "," + cf24[2] + "m\x1b[48;2;" + cb24[0] + "," + cb24[1] + "," + cb24[2] + "m";
    return returnValue;
}

function consoleColorReset(){
    return "\x1b[22;0m";
}

module.exports.startConsoleInput = (discordClient) => {
    if(!client) { // First init
        console.log("Running ConsoleChat.js " + versionString);
        if(!stopFunction) stopFunction = process.exit;
        mainInputLoop();
    }
    client = discordClient;
};

function mainInputLoop() {
    mainInputSuspended = false;
    mainInput = readline.createInterface({input:process.stdin, output:process.stdout, prompt:promptPrefix});
    if(lastInputHistory){
        // HACKY, TODO: find a better way of doing this if possible
        mainInput.history = lastInputHistory.history;
        mainInput.historyIndex = lastInputHistory.historyIndex;
        lastInputHistory = null;
    }
    mainInput.on("line", (data) => {
        if(mainInputSuspended) return;
        mainInputSuspended = true;
        lastInputHistory = {history:mainInput.history, historyIndex:mainInput.historyIndex};
        lastInputHeight = mainInput._getDisplayPos(mainInput._prompt + data).rows + 1;
        mainInput.close();
        var waiting = processCommand(data);
        if(!waiting) mainInputLoop();
    });
    mainInput.on("close", () => {
        if(!mainInputSuspended) {
            saveHomeCursor();
            mainInputSuspended = true;
            stopFunction();
        }
    });
    mainInput.prompt();
}

function saveHomeCursor() {
    if(!mainInputSuspended){
        // Get/save cursor info
        var cursor = mainInput.cursor;
        var pos = mainInput._getCursorPos();
        lastCursorPos = {cursor:cursor, pos:pos};
        // Re-prompt to jump to start of line quickly
        // TODO: Set empty prompt and save/clear line info?
        mainInput.prompt();
        // Move to start of line
        readline.cursorTo(process.stdout, 0);
        // Clear screen ready for message
        readline.clearScreenDown(process.stdout);
    }
}

function restoreCursor() {
    if(!mainInputSuspended){
        // Load cursor info
        var cursor = lastCursorPos.cursor;
        var pos = lastCursorPos.pos;
        // TODO: Load saved line info?
        // Re-prompt to display line info
        mainInput.prompt();
        // Restore cursor info
        readline.cursorTo(process.stdout, 0);
        readline.moveCursor(process.stdout, pos.cols, pos.rows);
        mainInput.cursor = cursor;
    }
}

function filterTagsAndEmoji(message) {
    return message.trim().replace(/(@\S+)/g, (match, num) => {
        var member = getMemberForTag(match.substring(1), consoleMsgChannel.guild);
        if(member) return member.toString();
        return match;
    }).replace(/(:\S+:)/g, (match, num) => {
        var emoji = getEmojiForName(match, consoleMsgChannel.guild);
        if(emoji) return emoji.toString();
        return match;
    });
}

function getServer(input) {
    var server = client.guilds.cache.find(s => s.id == input);
    if(!server) server = client.guilds.cache.find(s => s.name.toLowerCase() == input.toLowerCase().replace("_", " "));
    return server;
}

function getChannel(server, input, fallbackDefault) {
    var channels = getAllChannels(server);
    var channel;
    if(input) {
        var inputFilt = input.replace(/^#/, "");
        channel = channels.find(c => c.id === inputFilt);
        if(!channel) channel = channels.find(c => c.name == inputFilt.toLowerCase());
    }
    if(fallbackDefault){
        // Try to find #general
        if(!channel) channel = channels.find(c => c.name == "general");
        // If no #general, try the system messages channel
        if(!channel) channel = server.systemChannel;
        // If system messages channel is unset/disabled, use first available channel as a last resort
        if(!channel) channel = channels.first();
    }
    return channel;
}

function getAllChannels(server) {
    return server.channels.cache.filter(c => c.type === "text");
}

function filterNameArgument(arg) {
    return arg.trim()
        .replace(/<@\d+>/g, (match, num) => {return match.substring(2, match.length - 1)})
        .replace(/<@!\d+>/g, (match, num) => {return match.substring(3, match.length - 1)})
        .replace(/@\S+/g, (match, num) => {return match.substring(1)});
}

function getMemberForTag(tag, server) {
    var members = server.members.cache;
    var member;
    member = members.find(m => m.user.tag == tag); // Match full tag
    if(!member) member = members.find(m => m.user.id == tag); // Match full id
    if(!member) member = members.find(m => m.displayName == tag); // Match full display name
    if(!member) member = members.find(m => m.user.tag.toLowerCase().startsWith(tag.toLowerCase())); // Match start of tag (case insensitive)
    if(!member) member = members.find(m => m.displayName.toLowerCase().startsWith(tag.toLowerCase())); // Match start of display name (case insensitive)
    if(!member) member = members.find(m => m.displayName.toLowerCase().includes(tag.toLowerCase())); // Match any part of display name (case insensitive) 
    return member;
}

function getEmojiForName(name, server) {
    var fname = name.replace(/^:+/, '').replace(/:+$/, '');
    var emoji;
    emoji = server.emojis.cache.find(e => e.name === fname);
    return emoji;
}

function processCommand(d) {
    var cmsg = d.toString().trimRight();
    const prefix = "/";
    if(cmsg.startsWith(prefix)) {
        lastDisplayedUserId = null;
        var cmsgWithoutPrefix = cmsg.substring(prefix.length);
        var args = cmsgWithoutPrefix.split(" ");
        var command = args.shift().toLowerCase();
        var argsJoined;
        if(args.length > 0) argsJoined = cmsgWithoutPrefix.substring(command.length).trim();
        if(command == "channel") {
            if(!args.length == 1) {
                console.log(`Syntax: "${prefix}${command} <channel>".`);
                return;
            }
            if(!consoleMsgChannel){
                console.log(`You are not connected to any server! Use ${prefix}server to connect.`);
                return;
            }
            var channelArg = args[0];
            var channel = getChannel(consoleMsgChannel.guild, channelArg);
            if(!channel) {
                console.log(`Channel "${channelArg}" not found.`);
                return;
            }
            setChannel(channel);
            console.log("Moved to #" + channel.name);
        } else if(command == "server" || command == "guild") {
            var serverArg = argsJoined;
            if(!serverArg) {
                console.log(`Syntax: "${prefix}${command} <server>".`);
                return;
            }
            var server = getServer(serverArg)
            if(!server) {
                console.log(`Server "${serverArg}" not found.`);
                return;
            }
            var channelInput = readline.createInterface({input:process.stdin, output:process.stdout, prompt:"Channel (leave blank for default): "});
            channelInput.prompt();
            var channelInputFinished;
            channelInput.on("line", (channelArg) => {
                channelInputFinished = true;
                channelInput.close();
                if(!channelArg) channelArg = "";
                var channel = consoleMsgChannel;
                channel = getChannel(server, channelArg, true);
                if(!channel) {
                    if(channelArg.trim() != "") console.log(`Channel "${channelArg}" not found.`);
                    else console.log("Default channel not available.");
                    mainInputLoop();
                    return;
                }
                setChannel(channel);
                console.log(`Joined ${server.name} / #${channel.name}.`);
                mainInputLoop();
            });
            channelInput.on("close", () => {
                if(!channelInputFinished) {
                    mainInputSuspended = true;
                    stopFunction();
                }
            })
            return true; // waiting
        } else if(command == "listservers" || command == "listguilds") {
            console.log("Available servers:");
            client.guilds.cache.forEach(server => console.log("  " + server.name));
        } else if(command == "listchannels") {
            var serverArg = argsJoined;
            var server;
            if(args.length > 0){
                var server = getServer(serverArg);
                if(!server) {
                    console.log(`Server "${serverArg}" not found.`);
                    return;
                }
            } else {
                if(!consoleMsgChannel) {
                    console.log(`You are not connected to any server! Use ${prefix}server to connect.`);
                    return;
                }
                server = consoleMsgChannel.guild;
            }
            var channels = getAllChannels(server);
            console.log(`Available channels for ${args.length > 0 ? "server " + server.name : "current server"}:`);
            channels.forEach(channel => console.log("  #" + channel.name));
        } else if(command == "stop") {
            mainInputSuspended = true;
            stopFunction();
            return true;
        } else if(command == "cls") {
            console.clear();
        } else if(command == "help") {
            console.log(`ConsoleChat ${versionString} Help`);
            console.log(`  Messages starting with ${prefix} are treated as a command`);
            console.log("  Anything else will be sent to the connected channel");
            console.log("Command List:");
            console.log(`  ${prefix}help: Display this message`);
            console.log(`  ${prefix}server <server>: Connect to a joined server (alias ${prefix}guild)`);
            console.log(`  ${prefix}channel <channel>: Connect to a different channel on the current server`);
            console.log(`  ${prefix}listservers: List all authorized servers (alias ${prefix}listguilds)`);
            console.log(`  ${prefix}listchannels [server]: List channels on a joined server or the current server`);
            console.log(`  ${prefix}deauth [server]: Quit a joined server or the current server`);
            console.log(`  ${prefix}delete: Delete the previously sent message (alias ${prefix}del)`);
            console.log(`  ${prefix}cls: Clear the screen`);
            console.log(`  ${prefix}stop: Stop the bot`);
        } else if(command == "delete" || command == "del") {
            if(lastMessage) {
                lastMessage.delete();
                lastMessage = null;
                outputMessageDelete();
            } else {
                console.log("No message available to delete.");
            }
        } else if(command == "deauth") {
            var serverArg = argsJoined;
            var server;
            if(serverArg) {
                server = getServer(serverArg);
            } else {
                if(!consoleMsgChannel) {
                    console.log(`You are not connected to any server! Use ${prefix}server to connect.`);
                    return;
                }
                server = consoleMsgChannel.guild;
            }
            if(!server) {
                console.log(`Server ${serverArg} not found.`);
                return;
            }
            var sameServer = (!!consoleMsgChannel.guild) && (server.id == consoleMsgChannel.guild.id);
            if(sameServer) consoleMsgChannel = null;
            server.leave();
            console.log(`Deauthorized from server ${server.name}.`);
        } else {
            console.log(`Unknown command! Type ${prefix}help for a list of commands.`);
        }
    } else {
        if(consoleMsgChannel) {
            const filteredMessage = filterTagsAndEmoji(cmsg);
            if(filteredMessage.length > 0) sendMessage(filteredMessage);
        } else {
            console.log(`You are not connected to any server! Use ${prefix}server to connect.`);
        }
    }
}
