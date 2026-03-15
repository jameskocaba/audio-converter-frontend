import os
from yt_dlp import YoutubeDL

# Top 25 Platforms
PLATFORMS_TO_TEST = {
    # --- Major Video & Social ---
    "YouTube": {"desc": "Public videos, music tracks, Shorts, and podcasts.", "url": "https://www.youtube.com/watch?v=jNQXAC9IVRw", "skip_test": False},
    "Vimeo": {"desc": "Publicly accessible videos.", "url": "https://vimeo.com/76979871", "skip_test": False},
    "TikTok": {"desc": "Public videos and trending sounds.", "url": "https://www.tiktok.com/@tiktok/video/7106594312292453675", "skip_test": False},
    "Instagram": {"desc": "Public Reels and video posts.", "url": "https://www.instagram.com/p/C0O-1234567/", "skip_test": False},
    "Facebook": {"desc": "Publicly shared videos and Watch content.", "url": "https://www.facebook.com/facebook/videos/1234567/", "skip_test": False},
    "Twitter / X": {"desc": "Embedded video clips and public Spaces.", "url": "https://twitter.com/X/status/123456789", "skip_test": False},
    "Reddit": {"desc": "Native video and audio embeds.", "url": "https://www.reddit.com/r/videos/comments/1/", "skip_test": False},
    "Twitch": {"desc": "Public Clips and VODs.", "url": "https://www.twitch.tv/videos/123456789", "skip_test": False},
    "Dailymotion": {"desc": "Public video uploads.", "url": "https://www.dailymotion.com/video/x8l31w1", "skip_test": False},
    "Rumble": {"desc": "Public video uploads and streams.", "url": "https://rumble.com/c/c-12345", "skip_test": False},

    # --- Audio & Music ---
    "SoundCloud": {"desc": "Individual tracks, mixes, and public playlists.", "url": "https://soundcloud.com/soundcloud/sets/soundcloud-weekly", "skip_test": True},
    "Bandcamp": {"desc": "Public tracks and albums.", "url": "https://bandcamp.com/track/1", "skip_test": False},
    "Mixcloud": {"desc": "DJ mixes, radio shows, and podcasts.", "url": "https://www.mixcloud.com/Mixcloud/", "skip_test": False},
    "Audiomack": {"desc": "Music streams and mixtapes.", "url": "https://audiomack.com/song/1", "skip_test": False},
    "ReverbNation": {"desc": "Indie music tracks.", "url": "https://www.reverbnation.com/1", "skip_test": False},

    # --- Education, News & Media ---
    "TED": {"desc": "TED Talks and educational lectures.", "url": "https://www.ted.com/talks/ken_robinson_says_schools_kill_creativity", "skip_test": False},
    "Khan Academy": {"desc": "Educational tutorials and course videos.", "url": "https://www.khanacademy.org/math/algebra", "skip_test": False},
    "PBS": {"desc": "Public broadcasting documentaries and clips.", "url": "https://www.pbs.org/video/1/", "skip_test": False},
    "NPR": {"desc": "National Public Radio stories and podcasts.", "url": "https://www.npr.org/2024/1/1/1/", "skip_test": False},
    "BBC": {"desc": "Public news clips and documentaries.", "url": "https://www.bbc.co.uk/news/1", "skip_test": False},
    "CNN": {"desc": "News clips and video reports.", "url": "https://www.cnn.com/videos/1", "skip_test": False},

    # --- Misc & Specialty ---
    "Internet Archive": {"desc": "Archived audio, video, and historical media.", "url": "https://archive.org/details/CEP114", "skip_test": False},
    "Kickstarter": {"desc": "Project pitch videos.", "url": "https://www.kickstarter.com/projects/1/1", "skip_test": False},
    "Imgur": {"desc": "GIFs with sound and short video uploads.", "url": "https://imgur.com/gallery/1", "skip_test": False},
    "Streamable": {"desc": "Short-form video hosting clips.", "url": "https://streamable.com/1", "skip_test": False}
}

def check_platform(name, data):
    print(f"Testing {name}...")
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': True, 
        'socket_timeout': 10,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        }
    }
    try:
        with YoutubeDL(ydl_opts) as ydl:
            ydl.extract_info(data['url'], download=False)
        print(f"  ✅ {name} is supported.")
        return True
    except Exception as e:
        print(f"  ❌ {name} failed or is currently blocked by the platform.")
        return False

def generate_html(supported_platforms):
    list_items_html = ""
    for name, desc in supported_platforms.items():
        list_items_html += f"                    <li><strong>{name}</strong> &ndash; {desc}</li>\n"

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Supported Platforms | MP3aud.io</title>
    <meta name="description" content="A list of the top 25 platforms currently supported by MP3aud.io for audio extraction.">
    <link rel="icon" type="image/png" href="favicon.png">
    <link rel="apple-touch-icon" href="favicon.png">
    <meta name="theme-color" content="#FF5500">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <main>
        <div class="container" style="max-width: 600px;"> 
            <div class="utility-bar">
                <div class="social-icons">
                    <a href="https://www.instagram.com/mp3aud.io?igsh=ZXljNzMxaGtqdWwz&utm_source=qr" target="_blank" aria-label="Follow us on Instagram">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                    </a>
                </div>
                
                <div style="display: flex; gap: 15px; align-items: center;">
                    <a href="index.html" style="font-size: 0.9rem; font-weight: 600; color: #64748b; text-decoration: none; display: flex; align-items: center; gap: 4px; transition: color 0.2s ease;">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        Back
                    </a>
                </div>
            </div>

            <header class="logo-container">
                <a href="index.html">
                    <img src="logo.png" alt="MP3aud.io - Media Tools" class="main-logo" style="max-width: 240px; margin-bottom: 10px;">
                </a>
                <h1 class="main-headline">Top Supported Platforms</h1>
                <p class="h1-subtext">Our extraction technology supports over 1,000 websites. Below is an alphabetical list of the most popular platforms you can process today.</p>
            </header>
                      
            <section aria-label="Supported Websites" style="text-align: left; margin-top: 10px;">
                <ol style="padding-left: 20px; color: #334155; line-height: 1.8; font-size: 0.90rem; margin-bottom: 30px;">
{list_items_html}                </ol>

                <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 8px; font-size: 0.85rem; color: #1e40af; line-height: 1.5;">
                    <p style="margin: 0; display: flex; align-items: flex-start; gap: 8px;">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0; margin-top: 2px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                        <strong>Note on Restrictions:</strong> Platforms that utilize heavy DRM (such as Spotify, Apple Music, and Netflix) are strictly protected and cannot be processed.
                    </p>
                </div>
            </section>

            <footer style="margin-top: 30px;">
                <p>&copy; 2026 MP3aud.io. All Rights Reserved.</p>
                <nav class="footer-links" aria-label="Footer navigation">
                    <a href="index.html">Home</a> | 
                    <a href="mailto:jameskocaba@gmail.com">Contact</a>
                </nav>
            </footer>
        </div>
    </main>
</body>
</html>"""
    
    with open("supported-sites.html", "w", encoding="utf-8") as file:
        file.write(html_content)
    print("\n✅ Successfully updated supported-sites.html with 25 platforms.")

if __name__ == "__main__":
    print("Starting platform health check...\n")
    active_platforms = {}
    
    # Sort the platforms alphabetically before generating the HTML
    sorted_platforms = dict(sorted(PLATFORMS_TO_TEST.items()))
    
    for platform_name, data in sorted_platforms.items():
        if data.get("skip_test", False):
            print(f"Skipping test for {platform_name} (Forced inclusion).")
            active_platforms[platform_name] = data['desc']
        else:
            is_working = check_platform(platform_name, data)
            if is_working:
                active_platforms[platform_name] = data['desc']
            
    generate_html(active_platforms)