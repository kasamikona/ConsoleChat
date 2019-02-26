var consoleMsgChannel
var stdin

var ignoreBots = false
var useTimestamps = true
var useMessageGap = true
var useBotBadges = true
var stopFunction = process.exit

var client

const versionString = "v1.1"

module.exports.setIgnoreBots = (ignore=true) => {ignoreBots = ignore}
module.exports.setUseTimestamps = (use=true) => {useTimestamps = use}
module.exports.setUseMessageGap = (use=true) => {useMessageGap = use}
module.exports.setUseBotBadges = (use=true) => {useBotBadges = use}
module.exports.setStopFunction = (f) => {stopFunction = f}

function setChannel(channel) {consoleMsgChannel = channel}
module.exports.setChannel = setChannel

module.exports.onMessage = (message) => {
    if(message.author.bot && ignoreBots) return
    if (consoleMsgChannel) if (message.channel.id == consoleMsgChannel.id) {
        if(useMessageGap) console.log()
        var timestampString = ""
        if(useTimestamps) timestampString = "["+((new Date()).toTimeString().substring(0,8))+"] "
        var badgeString = ""
        if(useBotBadges) if(message.author.bot) badgeString = consoleBotBadge()
        console.log(timestampString+consoleColor(colorForMember(message.member))+message.member.displayName+consoleColorReset()+badgeString+": "+message.cleanContent)
        message.attachments.forEach((file) => {
            console.log(consoleColor(0)+" -> File "+file.url+" "+consoleColorReset())
        })
        message.embeds.forEach((embed) => {
            console.log(consoleColor(0)+" -> Embed "+embed.title+" "+consoleColorReset())
        })
    }
}

function consoleBotBadge(){
    return " \x1b[0;1;37;44;38;5;15;48;5;62;38;2;255;255;255;48;2;95;95;215mBOT"+consoleColorReset()
}

function colorForMember(member){
    var c = member.displayColor
    if(!c) return 16777215
    if(c<=0) return 16777215
    return c;
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
    // GAMMA CORRECTION
    //var gamma = 1.0
    //rgb=[Math.round(Math.pow(rgb[0]/255,gamma)*255),Math.round(Math.pow(rgb[1]/255,gamma)*255),Math.round(Math.pow(rgb[2]/255,gamma)*255)]
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
    console.log("Running ConsoleChat.js "+versionString)
    client = discordClient
    if(!stopFunction) stopFunction = process.exit
    stdin = process.openStdin()
    stdin.addListener("data", function(d) {
        var cmsg = d.toString().trimRight()
        if(cmsg.startsWith("/")) {
            var args = cmsg.substring(1).split(" ")
            var command = args.shift().toLowerCase()
            if(command == "channel") {
                var serverArg = args[0]
                var channelArg = args[1]
                if(args.length<1 || args.length>2) {
                    console.log()
                    console.log("Syntax: \"/channel <server name|id> [channel|id]\"\n  Replace spaces with _ in server name.")
                    console.log()
                    return
                }
                var servers = client.guilds
                server = servers.find(s => s.id === serverArg)
                if(!server) server = servers.find(s => s.name.toLowerCase() === serverArg.toLowerCase().replace("_"," "))
                if(!server) {
                    console.log()
                    console.log("Server "+serverArg+" not found.")
                    console.log()
                    return
                }
                var channels = server.channels.filter(c => c.type === "text")
                var channel
                if(channelArg) {
                    channel = channels.find(c => c.id === channelArg)
                    if(!channel) channel = channels.find(c => c.name === channelArg.toLowerCase())
                } else {
                    channel = channels.find(c => c.name === "general")
                }
                if(!channel) {
                    console.log()
                    console.log("Channel "+channelArg+" not found.")
                    console.log()
                    return
                }
                setChannel(channel)
                console.log()
                console.log("Connected console to " + server.name + " #" + channel.name)
                console.log()
            } else if(command == "stop") {
                stopFunction()
            } else if(command == "cls") {
                console.clear()
            } else if(command == "help") {
                console.log()
                console.log("ConsoleChat Help")
                console.log("  Messages starting with / are treated as a command.")
                console.log("  Anything else will be sent to the connected channel.")
                console.log("Command List:")
                console.log("  /help: Display this message")
                console.log("  /channel <server name|id> [channel|id]: Connect to a channel.\n    Replace spaces with _ in server name.")
                console.log("  /cls: Clear the screen.")
                console.log("  /stop: Stop the bot.")
                console.log()
            } else {
                console.log()
                console.log("Unknown command! Type /help for a list of commands.")
                console.log()
            }
        } else {
            if(consoleMsgChannel) {
                const filteredMessage = cmsg.trim().replace(/(@\S+)/g, (match, num) => {
                    var member = getUserForTag(match.substring(1), consoleMsgChannel.guild)
                    if(member) return member.toString()
                    return match
                }).replace(/(:\S+:)/g, (match, num) => {
                    var emoji = getEmojiForName(match, consoleMsgChannel.guild)
                    if(emoji) return emoji.toString()
                    return match
                })
                if(filteredMessage.length > 0) consoleMsgChannel.send(filteredMessage)
            } else {
                console.log()
                console.log("You are not connected to any channel! Use the /channel command to connect.")
                console.log()
            }
        }
    })
}

function getUserForTag(tag, server) {
    var members = server.members.filter(m => m.id != client.user.id)
    var member
    member = members.find(m => m.user.tag === tag) // Get full tag match
    if(!member) member = members.find(m => m.user.tag.toLowerCase().startsWith(tag.toLowerCase())) // Get first partial tag match
    if(!member) member = members.find(m => m.displayName === tag) // Get full display name match
    if(!member) member = members.find(m => m.displayName.toLowerCase().startsWith(tag.toLowerCase())) // Get first partial display name match
    return member
}

function getEmojiForName(name, server) {
    var fname = name.replace(/^:+/, '').replace(/:+$/, '')
    var emoji
    emoji = server.emojis.find(e => e.name === fname)
    //if(!emoji) emoji = client.emojis.find(e => e.name === fname)
    return emoji
}
