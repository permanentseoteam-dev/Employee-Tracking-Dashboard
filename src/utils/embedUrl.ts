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

/** Hosts that refuse iframe embedding (X-Frame-Options / CSP). */
const KNOWN_BLOCKED_HOSTS = [
  'github.com',
  'gitlab.com',
  'notion.so',
  'notion.site',
  'linear.app',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'facebook.com',
  'instagram.com',
  'app.slack.com',
  'zoom.us',
  'teams.microsoft.com',
  'web.whatsapp.com',
  'chat.openai.com',
  'chatgpt.com',
  'claude.ai',
  'airtable.com',
  'trello.com',
  'asana.com',
  'dropbox.com',
  'box.com',
  'atlassian.net',
  'jira.com',
  'confluence.com',
  'bitbucket.org',
  'reddit.com',
  'medium.com',
];

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
  cleaned = cleaned.replace(/^["'<(\[]+|["'>)\]]+$/g, '').trim();
  if (!cleaned) return '';
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `https://${cleaned}`;
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith('.' + domain);
}

function blockedResult(
  original: string,
  provider: string,
  notes?: string
): EmbedUrlInfo {
  return {
    originalUrl: original,
    embedUrl: original,
    provider,
    canEmbedInIframe: false,
    isKnownFrameBlocked: true,
    notes:
      notes ||
      `${provider} blocks in-app embedding. Use Open in Tab to view this link.`,
  };
}

function okResult(
  original: string,
  embedUrl: string,
  provider: string,
  notes?: string
): EmbedUrlInfo {
  return {
    originalUrl: original,
    embedUrl,
    provider,
    canEmbedInIframe: true,
    isKnownFrameBlocked: false,
    notes,
  };
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

    // Already an Office Online embed viewer
    if (host === 'view.officeapps.live.com') {
      return okResult(original, original, 'Microsoft Office', 'Office Online embed viewer.');
    }

    // 1. Google Docs (including /d/e/ published + /preview)
    if (host === 'docs.google.com' && pathname.includes('/document/')) {
      const published = pathname.match(/\/document\/(?:u\/\d+\/)?d\/e\/([a-zA-Z0-9_-]+)/);
      if (published?.[1]) {
        return okResult(
          original,
          `https://docs.google.com/document/d/e/${published[1]}/pub?embedded=true`,
          'Google Docs',
          'Published Google Doc embed.'
        );
      }
      const match = pathname.match(/\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
      if (match?.[1]) {
        return okResult(
          original,
          `https://docs.google.com/document/d/${match[1]}/preview`,
          'Google Docs',
          'Converted to preview mode. Share the doc as “Anyone with the link” for in-app viewing.'
        );
      }
    }

    // 2. Google Spreadsheets
    if (host === 'docs.google.com' && pathname.includes('/spreadsheets/')) {
      const published = pathname.match(/\/spreadsheets\/(?:u\/\d+\/)?d\/e\/([a-zA-Z0-9_-]+)/);
      if (published?.[1]) {
        return okResult(
          original,
          `https://docs.google.com/spreadsheets/d/e/${published[1]}/pubhtml?widget=true&headers=false`,
          'Google Sheets',
          'Published Google Sheet embed.'
        );
      }
      const match = pathname.match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
      if (match?.[1]) {
        const gid = parsed.searchParams.get('gid') || pathname.match(/gid=(\d+)/)?.[1];
        const gidParam = gid ? `?gid=${gid}` : '';
        return okResult(
          original,
          `https://docs.google.com/spreadsheets/d/${match[1]}/preview${gidParam}`,
          'Google Sheets',
          'Converted to sheet preview. Share as “Anyone with the link” if the frame stays blank.'
        );
      }
    }

    // 3. Google Presentations (Slides)
    if (host === 'docs.google.com' && pathname.includes('/presentation/')) {
      const match = pathname.match(/\/presentation\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
      if (match?.[1]) {
        return okResult(
          original,
          `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=3000`,
          'Google Slides',
          'Converted to embedded slide deck viewer.'
        );
      }
    }

    // 4. Google Drive
    if (host === 'drive.google.com') {
      if (pathname.includes('/folders/') || pathname.includes('/drive/folders/')) {
        return blockedResult(
          original,
          'Google Drive Folder',
          'Drive folders cannot be embedded. Open in Tab, or paste a link to a specific file.'
        );
      }
      const fileMatch = pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch?.[1]) {
        return okResult(
          original,
          `https://drive.google.com/file/d/${fileMatch[1]}/preview`,
          'Google Drive',
          'Converted to Drive file preview. Share the file as “Anyone with the link”.'
        );
      }
      const openMatch = pathname.match(/\/open/);
      const idParam = parsed.searchParams.get('id');
      if ((openMatch || pathname.includes('/uc')) && idParam) {
        return okResult(
          original,
          `https://drive.google.com/file/d/${idParam}/preview`,
          'Google Drive',
          'Converted to Drive file preview.'
        );
      }
      if (idParam) {
        return okResult(
          original,
          `https://drive.google.com/file/d/${idParam}/preview`,
          'Google Drive',
          'Converted to Drive file preview.'
        );
      }
    }

    // 5. Google Forms
    if (host === 'docs.google.com' && pathname.includes('/forms/')) {
      const clone = new URL(original);
      clone.searchParams.set('embedded', 'true');
      return okResult(original, clone.toString(), 'Google Forms');
    }

    // 6. YouTube
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
        const startParam = time ? `?start=${parseInt(String(time).replace(/\D/g, ''), 10) || 0}` : '';
        return okResult(
          original,
          `https://www.youtube-nocookie.com/embed/${videoId}${startParam}`,
          'YouTube',
          'Converted to YouTube embed player.'
        );
      }
    }

    // 7. Loom
    if (host.includes('loom.com')) {
      const match = pathname.match(/\/(?:share|embed)\/([a-zA-Z0-9_-]+)/);
      if (match?.[1]) {
        return okResult(original, `https://www.loom.com/embed/${match[1]}`, 'Loom');
      }
    }

    // 8. Vimeo
    if (host.includes('vimeo.com')) {
      if (host.includes('player.vimeo.com')) {
        return okResult(original, original, 'Vimeo');
      }
      const match = pathname.match(/\/(\d+)/);
      if (match?.[1]) {
        return okResult(original, `https://player.vimeo.com/video/${match[1]}`, 'Vimeo');
      }
    }

    // 9. Figma
    if (host.includes('figma.com')) {
      if (pathname.includes('/embed')) {
        return okResult(original, original, 'Figma');
      }
      return okResult(
        original,
        `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(original)}`,
        'Figma',
        'Converted to Figma embed viewer.'
      );
    }

    // 10. Spotify
    if (host === 'open.spotify.com') {
      if (pathname.includes('/embed/')) {
        return okResult(original, original, 'Spotify');
      }
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return okResult(
          original,
          `https://open.spotify.com/embed/${parts[0]}/${parts[1]}`,
          'Spotify'
        );
      }
    }

    // 11. CodePen
    if (host.includes('codepen.io') && pathname.includes('/pen/')) {
      return okResult(original, original.replace('/pen/', '/embed/'), 'CodePen');
    }

    // 12. Microsoft Office / OneDrive / SharePoint → Office Online embed viewer
    const isMsOfficeHost =
      hostMatches(host, 'onedrive.live.com') ||
      hostMatches(host, '1drv.ms') ||
      hostMatches(host, 'sharepoint.com') ||
      hostMatches(host, 'office.com') ||
      hostMatches(host, 'officeapps.live.com') ||
      host.includes('sharepoint.com') ||
      /\.(docx?|xlsx?|pptx?)($|\?)/i.test(pathname);

    if (isMsOfficeHost) {
      // SharePoint/OneDrive sharing pages often blank in iframes; Office viewer needs a public file URL.
      const embed = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(original)}`;
      const isSharingPage =
        hostMatches(host, '1drv.ms') ||
        hostMatches(host, 'onedrive.live.com') ||
        host.includes('sharepoint.com') ||
        /\/:[fwxp]:\//i.test(pathname);
      if (isSharingPage) {
        return {
          originalUrl: original,
          embedUrl: embed,
          provider: 'Microsoft Office',
          canEmbedInIframe: false,
          isKnownFrameBlocked: false,
          notes:
            'OneDrive/SharePoint sharing links usually blank in-app. Open in Tab, or Try Preview if the file is public.',
        };
      }
      return okResult(
        original,
        embed,
        'Microsoft Office',
        'Converted via Office Online viewer. The file must be publicly reachable; otherwise use Open in Tab.'
      );
    }

    // 13. Canva design share → embed
    if (host.includes('canva.com')) {
      if (pathname.includes('/view') || pathname.includes('/watch')) {
        const embedPath = pathname.replace(/\/(view|watch).*$/, '/view?embed');
        return okResult(
          original,
          `https://${host}${embedPath}${embedPath.includes('?') ? '' : '?embed'}`,
          'Canva',
          'Canva embed — design must allow public view.'
        );
      }
      return blockedResult(
        original,
        'Canva',
        'Use a Canva “Share → More → Embed” / view link. Open in Tab if the preview stays blank.'
      );
    }

    // 14. Miro boards
    if (host.includes('miro.com')) {
      const board = pathname.match(/\/app\/board\/([^/]+)/);
      if (board?.[1]) {
        return okResult(
          original,
          `https://miro.com/app/live-embed/${board[1]}/`,
          'Miro',
          'Converted to Miro live embed.'
        );
      }
    }

    // 15. Known frame-blocking domains
    const isKnownBlocked = KNOWN_BLOCKED_HOSTS.some((blocked) => hostMatches(host, blocked));

    let detectedProvider = 'Web Link';
    if (host.includes('google.com')) detectedProvider = 'Google';
    else if (host.includes('notion.so') || host.includes('notion.site')) detectedProvider = 'Notion';
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

    if (isKnownBlocked) {
      return blockedResult(original, detectedProvider);
    }

    // Generic sites usually refuse framing → show link card, not a blank iframe
    return {
      originalUrl: original,
      embedUrl: original,
      provider: detectedProvider,
      canEmbedInIframe: false,
      isKnownFrameBlocked: false,
      notes:
        'This site usually blocks in-app embedding. Open it in a new tab, or use Try Preview if the provider allows embeds.',
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
