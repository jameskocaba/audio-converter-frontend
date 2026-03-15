import os
from yt_dlp import YoutubeDL

# Dictionary of platforms and a highly stable, public test URL for each
PLATFORMS_TO_TEST = {
    "YouTube": {"desc": "Public videos, music tracks, and podcasts.", "url": "https://www.youtube.com/watch?v=jNQXAC9IVRw"},
    "SoundCloud": {"desc": "Individual tracks, mixes, and public playlists.", "url": "https://soundcloud.com/soundcloud/sets/soundcloud-weekly"},
    "Vimeo": {"desc": "Publicly accessible videos.", "url": "https://vimeo.com/76979871"},
    "Bandcamp": {"desc": "Public tracks and albums.", "url": "https://bandcamp.com/track/1"},
    "Twitch": {"desc": "Public Clips and VODs.", "url": "https://www.twitch.tv/videos/123456789"}, 
    "Reddit": {"desc": "Native video and audio embeds.", "url": "https://www.reddit.com/r/videos/comments/1/"},
    "TikTok": {"desc": "Public videos and trending sounds.", "url": "https://www.tiktok.com/@tiktok/video/7106594312292453675"},
    "Twitter / X": {"desc": "Embedded video clips.", "url": "https://twitter.com/X/status/123456789"},
    "Instagram": {"desc": "Public Reels and video posts.", "url": "https://www.instagram.com/p/C0O-1234567/"},
    "Facebook": {"desc": "Publicly shared videos and Watch content.", "url": "https://www.facebook.com/facebook/videos/1234567/"}
}

def check_platform(name, data):
    print(f"Testing {name}...")
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': True, # Only fetch metadata, do not download
        'socket_timeout': 10,
    }
    try:
        with YoutubeDL(ydl_opts) as ydl:
            # If extract_info succeeds without an exception, the extractor is working
            ydl.extract_info(data['url'], download=False)
        print(f"  ✅ {name} is supported.")
        return True
    except Exception as e:
        print(f"  ❌ {name} failed or is currently blocked by the platform.")
        return False

def generate_html(supported_platforms):
    # Generate the <li> elements only for successful platforms
    list_items_html = ""
    for name, desc in supported_platforms.items():
        list_items_html += f"                    <li><strong>{name}</strong> &ndash; {desc}</li>\n"

    # The HTML template for supported-sites.html
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Supported Platforms | MP3aud.io</title>
    <meta name="description" content="A list of the platforms currently supported by MP3aud.io for audio extraction.">
    <link rel="icon" type="image/png" href="favicon.png">
    <link rel="apple-touch-icon" href="favicon.png">
    <meta name="theme-color" content="#FF5500">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <main>
        <div class="container">
            
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
                    
                    <a href="top-5.html" class="top-five-link" style="font-size: 0.9rem; font-weight: 600; color: #2980b9; text-decoration: none; display: flex; align-items: center; gap: 4px; transition: color 0.2s ease;">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Top 5
                    </a>
                </div>
            </div>

            <header class="logo-container">
                <a href="index.html">
                    <img src="logo.png" alt="MP3aud.io - Media Tools" class="main-logo" style="max-width: 240px; margin-bottom: 10px;">
                </a>
                <h1 class="main-headline">Currently Supported Platforms</h1>
                <p class="h1-subtext">Our extraction technology supports hundreds of websites. Below is the real-time list of popular platforms currently online and processing successfully.</p>
            </header>
                      
            <section aria-label="Supported Websites" style="text-align: left; margin-top: 10px;">
                <ol style="padding-left: 20px; color: #334155; line-height: 1.8; font-size: 0.95rem; margin-bottom: 30px;">
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
    
    # Save to the new filename
    with open("supported-sites.html", "w", encoding="utf-8") as file:
        file.write(html_content)
    print("\n✅ Successfully updated supported-sites.html with active platforms.")

if __name__ == "__main__":
    print("Starting platform health check...\n")
    active_platforms = {}
    
    for platform_name, data in PLATFORMS_TO_TEST.items():
        is_working = check_platform(platform_name, data)
        if is_working:
            active_platforms[platform_name] = data['desc']
            
    generate_html(active_platforms)