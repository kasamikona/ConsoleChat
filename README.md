# ConsoleChat
Command-Line Chat Node Module for Discord.js Bots

Features:
* Connect to and chat with any Discord server the bot is a member of via the command line
* Send and receive text messages, including basic info for attachments and embeds
* Basic command support (type /help to see a list of commands)
* Supports emojis (:emoji_name:) and user tagging (by tag or nickname)
* Colors user nicknames by role colors (as accurate as the console window allows)

Basic setup (in your main bot script):
```javascript
const Discord = require('discord.js')
const client = new Discord.Client({disableEveryone: true})
const consoleChat = require('./consoleChat.js')
...

client.on('ready', () => {
    ...
    consoleChat.startConsoleInput(client)
    ...
})

client.on('message', function(message) {
    consoleChat.onMessage(message)
    ...
})

client.login(YOUR_SECRET_TOKEN)
...
```

Anywhere you would use `console.log(value)`:
```javascript
...
consoleChat.println(value)
...
```

Useful functions:
* consoleChat.setChannel(channel): Change the chat channel e.g. by command (takes a TextChannel object)
* consoleChat.hidePrompt(): Hide the console prompt to print messages without interruption
* consoleChat.showPrompt(): Restore from hidePrompt

Additional configuration functions:
* consoleChat.setIgnoreBots(ignore): Whether to ignore bot messages (default: `false`)
* consoleChat.setUseTimestamps(use): Whether to add timestamps to messages (default: `true`)
* consoleChat.setUseBotBadges(use): Whether to display a blue 'BOT' badge next to bot names (default: `true`)
* consoleChat.setStopFunction(function): Specify a function to run for the '/stop' command (default: `process.exit()`)
* consoleChat.setPromptPrefix(prefix): Specify a prompt prefix string (default: `"> "`)
* consoleChat.setGamma(value): Set the gamma value for color calculations (default: `1.2`)
