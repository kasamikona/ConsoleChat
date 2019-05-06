var readline = require('readline');

var consoleMsgChannel
var mainInput
var mainInputSuspended = true
var lastInputHistory // hacky method for maintaining history, may break if readline updates
var lastCursorPos
var lastDisplayedUserId = null
var lastMessage = null
var lastInputHeight

var ignoreBots = false
var useTimestamps = true
var useBotBadges = true
var stopFunction = process.exit
var promptPrefix = "> "

var client

const versionString = "v1.2.2"

module.exports.setIgnoreBots = (ignore=true) => {ignoreBots = ignore}
module.exports.setUseTimestamps = (use=true) => {useTimestamps = use}
module.exports.setUseBotBadges = (use=true) => {useBotBadges = use}
module.exports.setStopFunction = (f=process.exit) => {stopFunction = f}
module.exports.setPromptPrefix = (p="> ") => {promptPrefix = p}

function setChannel(channel) {
    consoleMsgChannel = channel
    lastDisplayedUserId = null
    //lastMessage = null
}
module.exports.setChannel = setChannel

module.exports.onMessage = (message) => {
    if(!consoleMsgChannel) return
    if(message.channel.id != consoleMsgChannel.id) return
    if(!(message.author.bot && ignoreBots)){
        saveHomeCursor()
        outputMessageMember(message.member)
        outputMessageCleanContent(message.cleanContent)
        message.attachments.forEach((file) => {
            outputMessageSpecial("File",file.url)
        })
        message.embeds.forEach((embed) => {
            outputMessageSpecial("Embed",embed.title)
        })
        restoreCursor()
    }
}

module.exports.hidePrompt = () => {
	saveHomeCursor()
}

module.exports.showPrompt = () => {
	restoreCursor()
}

module.exports.println = (message) => {
	saveHomeCursor()
	console.log(message)
	restoreCursor()
}

function outputMessageMember(member) {
    if(lastDisplayedUserId != member.user.id){
        var timeString = ""
        if(useTimestamps) timeString += " ("+((new Date()).toTimeString().substring(0,8))+")"
        var badgeString = ""
        if(useBotBadges && member.user.bot) badgeString = consoleBotBadge()
        var newUserString = `\n${consoleColorForMember(member)+member.displayName+consoleColorReset()}${badgeString}${timeString}:`
        console.log(newUserString)
        lastDisplayedUserId = member.user.id
    }
}

function outputMessageSpecial(type, detail){
    var detailWithColon = detail ? (": "+detail) : ""
    console.log(`${consoleColor(0)} -> ${type}${detailWithColon} ${consoleColorReset()}`)
}

function outputMessageDelete(){
    outputMessageSpecial("Deleted previous message")
}

function outputMessageCleanContent(cleanContent) {
    if(cleanContent && cleanContent.trim().length>0) console.log(cleanContent)
}

function sendMessage(inputLine) {
    if(!consoleMsgChannel) return
    erasePreviousLinesForInput(inputLine)
    consoleMsgChannel.send(inputLine).then(message => lastMessage = message).catch(() => {
        lastMessage = null
        console.log("\x1b[0;1;31mFailed to send message." + consoleColorReset())
    })
}

function erasePreviousLinesForInput(input) {
    readline.cursorTo(process.stdout, 0)
    readline.moveCursor(process.stdout, 0, -lastInputHeight)
    readline.clearScreenDown(process.stdout)
}

function consoleBotBadge(){
    return " \x1b[0;1;37;44;38;5;15;48;5;62;38;2;255;255;255;48;2;95;95;215mBOT"+consoleColorReset()
}

function consoleColorForMember(member){
    var c = member.displayColor
    if(!c || c<=0) c = 16777215
    return consoleColor(c);
}

function consoleColor(color=16777215){
    var rgb=[(color>>16)&255,(color>>8)&255,color&255]
    // Calculate 4bit approximation
    var minDiff = 1000
    var minDiffIndex = -1
    for(var i=0;i<16;i++){
        var intensity=(i&8)*10.625
        var rgbDiff=[((i&1)*170)+intensity-rgb[0], ((i&2)*85)+intensity-rgb[1], ((i&4)*42.5)+intensity-rgb[2]]
        var paletteDiff = Math.abs(rgbDiff[0]) + Math.abs(rgbDiff[1]) + Math.abs(rgbDiff[2])
        if(paletteDiff < minDiff) {
            minDiff = paletteDiff
            minDiffIndex = i
        }
    }
    // Add 4bit approximation and enable invert if too dark
    var returnValue = "\x1b["+((minDiffIndex==0)?"0;1;7":(((minDiffIndex>=8)?"1;3":"0;3")+(minDiffIndex&7)))+"m"
    // Set colors for dark text
    var cf8=16+(36*Math.round(rgb[0]/51))+(6*Math.round(rgb[1]/51))+Math.round(rgb[2]/51)
    var cb8=0
    var cf24=rgb
    var cb24=[0,0,0]
    if(minDiffIndex==0){ // Dark, foreground/background already inverted in 4bit command
        cb8=cf8
        cf8=15 
        cb24=cf24
        cf24=[255,255,255]
    }
    // Add 8bit approximation
    returnValue += "\x1b[38;5;"+cf8+";48;5;"+cb8+"m"
    // Add 24bit true color
    returnValue += "\x1b[38;2;"+cf24[0]+","+cf24[1]+","+cf24[2]+"m\x1b[48;2;"+cb24[0]+","+cb24[1]+","+cb24[2]+"m"
    return returnValue
}

function consoleColorReset(){
    return "\x1b[22;0m"
}

module.exports.startConsoleInput = (discordClient) => {
    if(!client) { // First init
		console.log("Running ConsoleChat.js "+versionString)
		if(!stopFunction) stopFunction = process.exit
		mainInputLoop()
	}
    client = discordClient
}

function mainInputLoop() {
    mainInputSuspended = false
    mainInput = readline.createInterface({input:process.stdin,output:process.stdout,prompt:promptPrefix})
    if(lastInputHistory){
        // HACKY, TODO: find a better way of doing this if possible
        mainInput.history = lastInputHistory.history
        mainInput.historyIndex = lastInputHistory.historyIndex
        lastInputHistory = null
    }
    mainInput.on("line", (data) => {
        if(mainInputSuspended) return
        mainInputSuspended = true
        lastInputHistory = {history:mainInput.history,historyIndex:mainInput.historyIndex}
        lastInputHeight = mainInput._getDisplayPos(mainInput._prompt+data).rows+1
        mainInput.close()
        var waiting = processCommand(data)
        if(!waiting) mainInputLoop()
    })
    mainInput.on("close", () => {
        if(!mainInputSuspended) stopFunction()
    })
    mainInput.prompt()
}

function saveHomeCursor() {
    if(!mainInputSuspended){
        // Get/save cursor info
        var cursor = mainInput.cursor
        var pos = mainInput._getCursorPos()
        lastCursorPos = {cursor:cursor,pos:pos}
        // Re-prompt to jump to start of line quickly
        // TODO: Set empty prompt and save/clear line info?
        mainInput.prompt()
        // Move to start of line
        readline.cursorTo(process.stdout, 0)
        // Clear screen ready for message
        readline.clearScreenDown(process.stdout)
    }
}

function restoreCursor() {
    if(!mainInputSuspended){
        // Load cursor info
        var cursor = lastCursorPos.cursor
        var pos = lastCursorPos.pos
        // TODO: Load saved line info?
        // Re-prompt to display line info
        mainInput.prompt()
        // Restore cursor info
        readline.cursorTo(process.stdout, 0)
        readline.moveCursor(process.stdout, pos.cols, pos.rows)
        mainInput.cursor = cursor
    }
}

function filterTagsAndEmoji(message) {
    return message.trim().replace(/(@\S+)/g, (match, num) => {
        var member = getMemberForTag(match.substring(1), consoleMsgChannel.guild)
        if(member) return member.toString()
        return match
    }).replace(/(:\S+:)/g, (match, num) => {
        var emoji = getEmojiForName(match, consoleMsgChannel.guild)
        if(emoji) return emoji.toString()
        return match
    })
}

function getServer(input) {
    var server = client.guilds.find(s => s.id == input)
    if(!server) server = client.guilds.find(s => s.name.toLowerCase() == input.toLowerCase().replace("_"," "))
    return server
}

function getChannel(server, input, fallbackDefault) {
    var channels = getAllChannels(server)
    var channel
    if(input) {
        inputFilt = input.replace(/^#/,"")
        channel = channels.find(c => c.id === inputFilt)
        if(!channel) channel = channels.find(c => c.name == inputFilt.toLowerCase())
    }
    if(fallbackDefault){
        if(!channel) channel = channels.find(c => c.name == "general")
        // TODO: Get default channel if #general doesn't exist
    }
    return channel
}

function getAllChannels(server) {
    return server.channels.filter(c => c.type === "text")
}

function filterNameArgument(arg) {
    return arg.trim()
        .replace(/<@\d+>/g, (match, num) => {return match.substring(2,match.length-1)})
        .replace(/<@!\d+>/g, (match, num) => {return match.substring(3,match.length-1)})
        .replace(/@\S+/g, (match, num) => {return match.substring(1)})
}

function getMemberForTag(tag, server) {
    var members = server.members
    var member
    member = members.find(m => m.user.tag == tag) // Match full tag
    if(!member) member = members.find(m => m.user.id == tag) // Match full id
    if(!member) member = members.find(m => m.displayName == tag) // Match full display name
    if(!member) member = members.find(m => m.user.tag.toLowerCase().startsWith(tag.toLowerCase())) // Match start of tag (case insensitive)
    if(!member) member = members.find(m => m.displayName.toLowerCase().startsWith(tag.toLowerCase())) // Match start of display name (case insensitive)
    if(!member) member = members.find(m => m.displayName.toLowerCase().includes(tag.toLowerCase())) // Match any part of display name (case insensitive) 
    return member
}

function getEmojiForName(name, server) {
    var fname = name.replace(/^:+/, '').replace(/:+$/, '')
    var emoji
    emoji = server.emojis.find(e => e.name === fname)
    //if(!emoji) emoji = client.emojis.find(e => e.name === fname)
    return emoji
}

function processCommand(d) {
    var cmsg = d.toString().trimRight()
    if(cmsg.startsWith("/")) {
		lastDisplayedUserId = null
        var cmsgWithoutPrefix = cmsg.substring("/".length)
        var args = cmsgWithoutPrefix.split(" ")
        var command = args.shift().toLowerCase()
        var argsJoined
        if(args.length > 0) argsJoined = cmsgWithoutPrefix.substring(command.length).trim()
        if(command == "channel") {
            if(!args.length == 1) {
                console.log("Syntax: \"/" + command + " <channel>\".")
                return
            }
            if(!consoleMsgChannel){
                console.log("You are not connected to any server! Use /server to connect.")
                return
            }
            var channelArg = args[0]
            var channel = getChannel(consoleMsgChannel.guild, channelArg)
            if(!channel) {
                console.log("Channel \""+channelArg+"\" not found.")
                return
            }
            setChannel(channel)
            console.log("Moved to #" + channel.name+"")
        } else if(command == "server" || command == "guild") {
            var serverArg = argsJoined
            if(!serverArg) {
                console.log("Syntax: \"/" + command + " <server>\".")
                return
            }
            var server = getServer(serverArg)
            if(!server) {
                console.log("Server \""+serverArg+"\" not found.")
                return
            }
            var channelInput = readline.createInterface({input:process.stdin,output:process.stdout,prompt:"Channel (leave blank for default): "})
            channelInput.prompt()
            var channelInputFinished
            channelInput.on("line", (channelArg) => {
                channelInputFinished = true
                channelInput.close()
                if(!channelArg) channelArg = ""
                var channel = consoleMsgChannel
                channel = getChannel(server, channelArg, true)
                if(!channel) {
                    if(channelArg.trim() != "") console.log("Channel \""+channelArg+"\" not found.")
                    else console.log("Default channel not available.")
                    mainInputLoop()
                    return
                }
                setChannel(channel)
                console.log(`Joined ${server.name} / #${channel.name}.`)
                mainInputLoop()
            })
            channelInput.on("close", () => {
                if(!channelInputFinished) stopFunction()
            })
            return true // waiting
        } else if(command == "listservers" || command == "listguilds") {
            console.log("Available servers:")
            client.guilds.forEach(server => console.log("  "+server.name))
        } else if(command == "listchannels") {
            var serverArg = argsJoined
            var server
            if(args.length > 0){
                var server = getServer(serverArg)
                if(!server) {
                    console.log("Server \""+serverArg+"\" not found.")
                    return
                }
            } else {
                if(!consoleMsgChannel) {
                    console.log("You are not connected to any server! Use /server to connect.")
                    return
                }
                server = consoleMsgChannel.guild
            }
            var channels = getAllChannels(server)
            console.log("Available channels for "+(args.length > 0?"server "+server.name:"current server")+":")
            channels.forEach(channel => console.log("  #"+channel.name))
        } else if(command == "stop") {
            stopFunction()
        } else if(command == "cls") {
            console.clear()
        } else if(command == "help") {
            console.log("ConsoleChat "+versionString+" Help")
            console.log("  Messages starting with / are treated as a command")
            console.log("  Anything else will be sent to the connected channel")
            console.log("Command List:")
            console.log("  /help: Display this message")
            console.log("  /server <server>: Connect to a joined server (alias /guild)")
            console.log("  /channel <channel>: Connect to a different channel on the current server")
            console.log("  /listservers: List all authorized servers (alias /listguilds)")
            console.log("  /listchannels [server]: List channels on a joined server or the current server")
            console.log("  /deauth [server]: Quit a joined server or the current server")
            console.log("  /delete: Delete the previously sent message (alias /del)")
            console.log("  /cls: Clear the screen")
            console.log("  /stop: Stop the bot")
        } else if(command == "delete" || command == "del") {
            if(lastMessage) {
                lastMessage.delete()
                lastMessage = null
                outputMessageDelete()
            } else {
                console.log("No message available to delete.")
            }
        } else if(command == "deauth") {
            var serverArg = argsJoined
            var server
            if(serverArg) {
                server = getServer(serverArg)
            } else {
                if(!consoleMsgChannel) {
                    console.log("You are not connected to any server! Use /server to connect.")
                    return
                }
                server = consoleMsgChannel.guild
            }
            if(!server) {
                console.log("Server "+serverArg+" not found.")
                return
            }
            var sameServer = (server.id == consoleMsgChannel.guild.id)
            if(sameServer) consoleMsgChannel = null
            server.leave()
            console.log("Deauthorized from server "+server.name+".")
        } else {
            console.log("Unknown command! Type /help for a list of commands.")
        }
    } else {
        if(consoleMsgChannel) {
            const filteredMessage = filterTagsAndEmoji(cmsg)
            if(filteredMessage.length > 0) sendMessage(filteredMessage)
        } else {
            console.log("You are not connected to any server! Use /server to connect.")
        }
    }
}