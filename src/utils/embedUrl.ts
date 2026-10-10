/**
 * Utilities for parsing, normalizing, and converting arbitrary URLs
 * or <iframe> snippets into valid, embed-ready links for in-app display.
 */

export interface EmbedUrlInfo {
  originalUrl: string;
  embedUrl: string;
  provider: string;
  canEmbedInIframe: boolean;
  isKnownFrameBlocked: boolean;
  notes?: string;
}

/**
 * Extracts a URL from raw HTML if the user pasted an <iframe> code snippet.
 */
export function extractUrlFromHtml(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed.includes('<iframe') || trimmed.includes('src=')) {
    const srcMatch = trimmed.match(/src=["']([^"']+)["']/i);
    if (srcMatch && srcMatch[1]) {
      return srcMatch[1].trim();
    }
  }
  return trimmed;
}

/**
 * Normalizes input: extracts URL from HTML if needed, strips surrounding noise,
 * and ensures https:// scheme is present.
 */
export function normalizeRawUrl(url: string): string {
  let cleaned = extractUrlFromHtml(url);
  cleaned = cleaned.trim();
  if (!cleaned) return '';
  // strip surrounding quotes or brackets if present
  cleaned = cleaned.replace(/^["'<(\[]+|["'>)\]]+$/g, '').trim();
  if (!cleaned) return '';
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `https://${cleaned}`;
}

/**
 * Transforms standard view/edit URLs into official, iframe-friendly embed formats
 * to bypass X-Frame-Options: SAMEORIGIN / CSP frame-ancestors restrictions.
 */
export function parseAndTransformEmbedUrl(rawInput: string): EmbedUrlInfo {
  const original = normalizeRawUrl(rawInput);
  if (!original) {
    return {
      originalUrl: '',
      embedUrl: '',
      provider: 'Web Link',
      canEmbedInIframe: false,
      isKnownFrameBlocked: false,
    };
  }

  try {
    const parsed = new URL(original);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    // 1. Google Docs (/edit, /view -> /preview)
    if (host === 'docs.google.com' && pathname.includes('/document/')) {
      const match = pathname.match(/\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return {
          originalUrl: original,
          embedUrl: `https://docs.google.com/document/d/${match[1]}/preview`,
          provider: 'Google Docs',
          canEmbedInIframe: true,
          isKnownFrameBlocked: false,
          notes: 'Converted from edit to preview mode for in-app viewing.',
        };
      }
    }

    // 2. Google Spreadsheets (/edit -> /preview)
    if (host === 'docs.google.com' && pathname.includes('/spreadsheets/')) {
      const match = pathname.match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        const gid = parsed.searchParams.get('gid') || parsed.hash.match(/gid=(\d+)/)?.[1];
        const gidParam = gid ? `?gid=${gid}` : '';
        return {
          originalUrl: original,
          embedUrl: `https://docs.google.com/spreadsheets/d/${match[1]}/preview${gidParam}`,
          provider: 'Google Sheets',
          canEmbedInIframe: true,
          isKnownFrameBlocked: false,
          notes: 'Converted to interactive sheet preview.',
        };
      }
    }

    // 3. Google Presentations (Slides) (/edit -> /embed)
    if (host === 'docs.google.com' && pathname.includes('/presentation/')) {
      const match = pathname.match(/\/presentation\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return {
          originalUrl: original,
          embedUrl: `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=3000`,
          provider: 'Google Slides',
          canEmbedInIframe: true,
          isKnownFrameBlocked: false,
          notes: 'Converted to embedded slide deck viewer.',
        };
      }
    }

    // 4. Google Drive files (PDFs, images, etc.) (/view -> /preview)
    if (host === 'drive.google.com') {
      const fileMatch = pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch && fileMatch[1]) {
        return {
          originalUrl: original,
          embedUrl: `https://drive.google.com/file/d/${fileMatch[1]}/preview`,
          provider: 'Google Drive',
          canEmbedInIframe: true,
          isKnownFrameBlocked: false,
          notes: 'Converted to Google Drive document preview.',
        };
      }
      const idParam = parsed.searchParams.get('id');
      if (idParam) {
        return {
          originalUrl: original,
          embedUrl: `https://drive.google.com/file/d/${idParam}/preview`,
          provider: 'Google Drive',
          canEmbedInIframe: true,
          isKnownFrameBlocked: false,
        };
      }
    }

    // 5. Google Forms
    if (host === 'docs.google.com' && pathname.includes('/forms/')) {
      const clone = new URL(original);
      clone.searchParams.set('embedded', 'true');
      return {
        originalUrl: original,
        embedUrl: clone.toString(),
        provider: 'Google Forms',
        canEmbedInIframe: true,
        isKnownFrameBlocked: false,
      };
    }

    // 6. YouTube (watch?v=, youtu.be, shorts -> /embed/)
    if (host.includes('youtube.com') || host === 'youtu.be') {
      let videoId = '';
      if (host === 'youtu.be') {
        videoId = pathname.replace(/^\/+/, '').split('/')[0];
      } else if (pathname.includes('/shorts/')) {
        videoId = pathname.split('/shorts/')[1]?.split('/')[0] || '';
      } else if (pathname.includes('/embed/')) {
        videoId = pathname.split('/embed/')[1]?.split('/')[0] || '';
      } else {
        videoId = parsed.searchParams.get('v') || '';
      }

      if (videoId) {
        const time = parsed.searchParams.get('t') || parsed.searchParams.get('start');
        const startParam = time ? `?start=${parseInt(time, 10) || 0}` : '';
        return {
          originalUrl: original,
          embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}${startParam}`,
          provider: 'YouTube',
          canEmbedInIframe: true,
          isKnownFrameBlocked: false,
          notes: 'Converted to responsive YouTube embed player.',
        };
      }
    }

    // 7. Loom (/share -> /embed)
    if (host.includes('loom.com')) {
      const match = pathname.match(/\/(?:share|embed)\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return {
          originalUrl: original,
          embedUrl: `https://www.loom.com/embed/${match[1]}`,
          provider: 'Loom',
          canEmbedInIframe: true,
          isKnownFrameBlocked: false,
          notes: 'Converted to responsive Loom player.',
        };
      }
    }

    // 8. Vimeo
    if (host.includes('vimeo.com')) {
      if (host.includes('player.vimeo.com')) {
        return {
          originalUrl: original,
          embedUrl: original,
          provider: 'Vimeo',
          canEmbedInIframe: true,
          isKnownFrameBlocked: false,
        };
      }
      const match = pathname.match(/\/(\d+)/);
      if (match && match[1]) {
        return {
          originalUrl: original,
          embedUrl: `https://player.vimeo.com/video/${match[1]}`,
          provider: 'Vimeo',
          canEmbedInIframe: true,
          isKnownFrameBlocked: false,
        };
      }
    }

    // 9. Figma
    if (host.includes('figma.com')) {
      if (pathname.includes('/embed')) {
        return {
          originalUrl: original,
          embedUrl: original,
          provider: 'Figma',
          canEmbedInIframe: true,
          isKnownFrameBlocked: false,
        };
      }
      return {
        originalUrl: original,
        embedUrl: `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(original)}`,
        provider: 'Figma',
        canEmbedInIframe: true,
        isKnownFrameBlocked: false,
        notes: 'Converted to interactive Figma embed viewer.',
      };
    }

    // 10. Spotify
    if (host === 'open.spotify.com') {
      if (pathname.includes('/embed/')) {
        return {
          originalUrl: original,
          embedUrl: original,
          provider: 'Spotify',
          canEmbedInIframe: true,
          isKnownFrameBlocked: false,
        };
      }
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return {
          originalUrl: original,
          embedUrl: `https://open.spotify.com/embed/${parts[0]}/${parts[1]}`,
          provider: 'Spotify',
          canEmbedInIframe: true,
          isKnownFrameBlocked: false,
        };
      }
    }

    // 11. CodePen
    if (host.includes('codepen.io') && pathname.includes('/pen/')) {
      return {
        originalUrl: original,
        embedUrl: original.replace('/pen/', '/embed/'),
        provider: 'CodePen',
        canEmbedInIframe: true,
        isKnownFrameBlocked: false,
      };
    }

    // 12. Known frame-blocking domains (security policies)
    const knownBlockedHosts = [
      'github.com',
      'gitlab.com',
      'notion.so',
      'linear.app',
      'twitter.com',
      'x.com',
      'linkedin.com',
      'facebook.com',
      'instagram.com',
      'app.slack.com',
      'zoom.us',
    ];

    const isKnownBlocked = knownBlockedHosts.some(
      (blocked) => host === blocked || host.endsWith('.' + blocked)
    );

    let detectedProvider = 'Web Link';
    if (host.includes('google.com')) detectedProvider = 'Google';
    else if (host.includes('notion.so')) detectedProvider = 'Notion';
    else if (host.includes('github.com')) detectedProvider = 'GitHub';
    else if (host.includes('canva.com')) detectedProvider = 'Canva';
    else if (host.includes('airtable.com')) detectedProvider = 'Airtable';
    else if (host.includes('trello.com')) detectedProvider = 'Trello';
    else if (host.includes('miro.com')) detectedProvider = 'Miro';
    else {
      const domainParts = host.split('.');
      if (domainParts.length >= 2) {
        const root = domainParts[domainParts.length - 2];
        detectedProvider = root.charAt(0).toUpperCase() + root.slice(1);
      }
    }

    return {
      originalUrl: original,
      embedUrl: original,
      provider: detectedProvider,
      canEmbedInIframe: !isKnownBlocked,
      isKnownFrameBlocked: isKnownBlocked,
      notes: isKnownBlocked
        ? `${detectedProvider} restricts iframe embedding for security. Open in new tab recommended.`
        : undefined,
    };
  } catch {
    return {
      originalUrl: original,
      embedUrl: original,
      provider: 'Web Link',
      canEmbedInIframe: true,
      isKnownFrameBlocked: false,
    };
  }
}
