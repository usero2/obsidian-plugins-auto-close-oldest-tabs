# Obsidian Auto Close Oldest Tabs

A lightweight Obsidian plugin that helps you keep your workspace clean by automatically closing the oldest tabs when you reach a predefined limit. 
No more endless cluttered tabs! Just set your desired limit, and the plugin will seamlessly close your least recently used (LRU) tabs in the background.

![](https://github.com/usero2/obsidian-plugins-auto-close-oldest-tabs/blob/main/images/Obsidian_kLr2D4McOE.gif)

## Features

- **Tab Limiter**: Set a maximum number of tabs allowed to be open simultaneously in the main workspace.
- **Least Recently Used (LRU) Logic**: When the limit is exceeded, the plugin smartly identifies and closes the tab that you haven't interacted with for the longest time, ensuring your active work is never disrupted.
- **Force Open in New Tab**: A built-in option to prevent Obsidian from replacing your active tab when you click on links or files. This ensures your navigation naturally opens new tabs until the limit is reached, giving you a smooth browsing experience.

## Installation

### Manual Installation
1. Download the latest release (`main.js`, `manifest.json`, `styles.css` if any).
2. Create a folder named `obsidian-plugins-auto-close-oldest-tabs` inside your vault's `.obsidian/plugins/` directory.
3. Place the downloaded files into that folder.
4. Reload Obsidian and turn off **Safe Mode** in `Settings > Community plugins`.
5. Enable the "Auto Close Oldest Tabs" plugin.

## Usage & Settings

Once the plugin is enabled, you can configure it via `Settings > Auto Close Oldest Tabs`:

1. **Maximum open tabs**: Enter the maximum number of tabs you want to keep open (Default is `3`). Once you open the 4th tab, the oldest tab will automatically close.
2. **Always open in new tab**: Toggle this ON if you want clicks on internal links and files to always open in a new tab instead of replacing the one you are currently reading.

## ❤️ Support & Donate

If this plugin has improved your Obsidian workflow, saved you time, or you just want to support its continued development, please consider donating! 

Your support is incredibly appreciated, helps fix bugs, and keeps this project alive and growing. 🙏

https://buymeacoffee.com/endofday

<a href="https://www.buymeacoffee.com/endofday" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>
---
**Built with ❤️ for the Obsidian Community**
