interface GoogleFontItem {
  category: 'display' | 'handwriting' | 'monospace' | 'sans-serif' | 'serif';
  family: string;
  hasItalic: boolean;
  weights: number[];
}

const GOOGLE_FONTS_CATALOG: GoogleFontItem[] = [
  { category: 'sans-serif', family: 'Roboto', hasItalic: true, weights: [100, 300, 400, 500, 700, 900] },
  { category: 'sans-serif', family: 'Open Sans', hasItalic: true, weights: [300, 400, 500, 600, 700, 800] },
  { category: 'sans-serif', family: 'Montserrat', hasItalic: true, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { category: 'sans-serif', family: 'Lato', hasItalic: true, weights: [100, 300, 400, 700, 900] },
  { category: 'sans-serif', family: 'Poppins', hasItalic: true, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { category: 'sans-serif', family: 'Inter', hasItalic: false, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { category: 'sans-serif', family: 'Oswald', hasItalic: false, weights: [200, 300, 400, 500, 600, 700] },
  { category: 'sans-serif', family: 'Raleway', hasItalic: true, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { category: 'sans-serif', family: 'Nunito', hasItalic: true, weights: [200, 300, 400, 500, 600, 700, 800, 900] },
  { category: 'sans-serif', family: 'Rubik', hasItalic: true, weights: [300, 400, 500, 600, 700, 800, 900] },
  { category: 'sans-serif', family: 'Ubuntu', hasItalic: true, weights: [300, 400, 500, 700] },
  { category: 'sans-serif', family: 'Work Sans', hasItalic: true, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { category: 'sans-serif', family: 'DM Sans', hasItalic: true, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { category: 'sans-serif', family: 'Plus Jakarta Sans', hasItalic: true, weights: [200, 300, 400, 500, 600, 700, 800] },
  { category: 'sans-serif', family: 'Quicksand', hasItalic: false, weights: [300, 400, 500, 600, 700] },
  { category: 'sans-serif', family: 'Barlow', hasItalic: true, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { category: 'sans-serif', family: 'Manrope', hasItalic: false, weights: [200, 300, 400, 500, 600, 700, 800] },
  { category: 'sans-serif', family: 'Heebo', hasItalic: false, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { category: 'sans-serif', family: 'Mulish', hasItalic: true, weights: [200, 300, 400, 500, 600, 700, 800, 900] },
  { category: 'sans-serif', family: 'Cabin', hasItalic: true, weights: [400, 500, 600, 700] },
  { category: 'sans-serif', family: 'Karla', hasItalic: true, weights: [200, 300, 400, 500, 600, 700, 800] },
  { category: 'sans-serif', family: 'Jost', hasItalic: true, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { category: 'sans-serif', family: 'Figtree', hasItalic: true, weights: [300, 400, 500, 600, 700, 800, 900] },
  { category: 'sans-serif', family: 'Outfit', hasItalic: false, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { category: 'sans-serif', family: 'Space Grotesk', hasItalic: false, weights: [300, 400, 500, 600, 700] },
  { category: 'sans-serif', family: 'Syne', hasItalic: false, weights: [400, 500, 600, 700, 800] },
  { category: 'sans-serif', family: 'Urbanist', hasItalic: true, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { category: 'sans-serif', family: 'Be Vietnam Pro', hasItalic: true, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { category: 'sans-serif', family: 'Kanit', hasItalic: true, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { category: 'sans-serif', family: 'Lexend', hasItalic: false, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { category: 'serif', family: 'Playfair Display', hasItalic: true, weights: [400, 500, 600, 700, 800, 900] },
  { category: 'serif', family: 'Merriweather', hasItalic: true, weights: [300, 400, 700, 900] },
  { category: 'serif', family: 'Lora', hasItalic: true, weights: [400, 500, 600, 700] },
  { category: 'serif', family: 'PT Serif', hasItalic: true, weights: [400, 700] },
  { category: 'serif', family: 'Cinzel', hasItalic: false, weights: [400, 500, 600, 700, 800, 900] },
  { category: 'serif', family: 'Cormorant Garamond', hasItalic: true, weights: [300, 400, 500, 600, 700] },
  { category: 'serif', family: 'EB Garamond', hasItalic: true, weights: [400, 500, 600, 700, 800] },
  { category: 'serif', family: 'Bodoni Moda', hasItalic: true, weights: [400, 500, 600, 700, 800, 900] },
  { category: 'serif', family: 'Crimson Text', hasItalic: true, weights: [400, 600, 700] },
  { category: 'serif', family: 'Bitter', hasItalic: true, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { category: 'serif', family: 'Libre Baskerville', hasItalic: true, weights: [400, 700] },
  { category: 'serif', family: 'Arvo', hasItalic: true, weights: [400, 700] },
  { category: 'serif', family: 'Spectral', hasItalic: true, weights: [200, 300, 400, 500, 600, 700, 800] },
  { category: 'serif', family: 'Cardo', hasItalic: true, weights: [400, 700] },
  { category: 'serif', family: 'DM Serif Display', hasItalic: true, weights: [400] },
  { category: 'serif', family: 'Alegreya', hasItalic: true, weights: [400, 500, 600, 700, 800, 900] },
  { category: 'serif', family: 'Prata', hasItalic: false, weights: [400] },
  { category: 'serif', family: 'Fraunces', hasItalic: true, weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { category: 'display', family: 'Bebas Neue', hasItalic: false, weights: [400] },
  { category: 'display', family: 'Lobster', hasItalic: false, weights: [400] },
  { category: 'display', family: 'Abril Fatface', hasItalic: false, weights: [400] },
  { category: 'display', family: 'Righteous', hasItalic: false, weights: [400] },
  { category: 'display', family: 'Alfa Slab One', hasItalic: false, weights: [400] },
  { category: 'display', family: 'Anton', hasItalic: false, weights: [400] },
  { category: 'display', family: 'Bangers', hasItalic: false, weights: [400] },
  { category: 'display', family: 'Bungee', hasItalic: false, weights: [400] },
  { category: 'display', family: 'Comfortaa', hasItalic: false, weights: [300, 400, 500, 600, 700] },
  { category: 'display', family: 'Fredoka', hasItalic: false, weights: [300, 400, 500, 600, 700] },
  { category: 'display', family: 'Permanent Marker', hasItalic: false, weights: [400] },
  { category: 'display', family: 'Monoton', hasItalic: false, weights: [400] },
  { category: 'display', family: 'Press Start 2P', hasItalic: false, weights: [400] },
  { category: 'display', family: 'Shrikhand', hasItalic: false, weights: [400] },
  { category: 'display', family: 'Ultra', hasItalic: false, weights: [400] },
  { category: 'display', family: 'Titan One', hasItalic: false, weights: [400] },
  { category: 'display', family: 'Cinzel Decorative', hasItalic: false, weights: [400, 700, 900] },
  { category: 'display', family: 'Chango', hasItalic: false, weights: [400] },
  { category: 'display', family: 'Faster One', hasItalic: false, weights: [400] },
  { category: 'display', family: 'Creepster', hasItalic: false, weights: [400] },
  { category: 'display', family: 'Rye', hasItalic: false, weights: [400] },
  { category: 'display', family: 'Silkscreen', hasItalic: false, weights: [400, 700] },
  { category: 'handwriting', family: 'Dancing Script', hasItalic: false, weights: [400, 500, 600, 700] },
  { category: 'handwriting', family: 'Pacifico', hasItalic: false, weights: [400] },
  { category: 'handwriting', family: 'Caveat', hasItalic: false, weights: [400, 500, 600, 700] },
  { category: 'handwriting', family: 'Satisfy', hasItalic: false, weights: [400] },
  { category: 'handwriting', family: 'Shadows Into Light', hasItalic: false, weights: [400] },
  { category: 'handwriting', family: 'Great Vibes', hasItalic: false, weights: [400] },
  { category: 'handwriting', family: 'Sacramento', hasItalic: false, weights: [400] },
  { category: 'handwriting', family: 'Courgette', hasItalic: false, weights: [400] },
  { category: 'handwriting', family: 'Indie Flower', hasItalic: false, weights: [400] },
  { category: 'handwriting', family: 'Kalam', hasItalic: false, weights: [300, 400, 700] },
  { category: 'handwriting', family: 'Kaushan Script', hasItalic: false, weights: [400] },
  { category: 'handwriting', family: 'Yellowtail', hasItalic: false, weights: [400] },
  { category: 'handwriting', family: 'Marck Script', hasItalic: false, weights: [400] },
  { category: 'handwriting', family: 'Alex Brush', hasItalic: false, weights: [400] },
  { category: 'handwriting', family: 'Amatic SC', hasItalic: false, weights: [400, 700] },
  { category: 'handwriting', family: 'Parisienne', hasItalic: false, weights: [400] },
  { category: 'handwriting', family: 'Allura', hasItalic: false, weights: [400] },
  { category: 'handwriting', family: 'Homemade Apple', hasItalic: false, weights: [400] },
  { category: 'handwriting', family: 'Reenie Beanie', hasItalic: false, weights: [400] },
  { category: 'monospace', family: 'Fira Code', hasItalic: false, weights: [300, 400, 500, 600, 700] },
  { category: 'monospace', family: 'Roboto Mono', hasItalic: true, weights: [100, 200, 300, 400, 500, 600, 700] },
  { category: 'monospace', family: 'Source Code Pro', hasItalic: true, weights: [200, 300, 400, 500, 600, 700, 800, 900] },
  { category: 'monospace', family: 'Space Mono', hasItalic: true, weights: [400, 700] },
  { category: 'monospace', family: 'Inconsolata', hasItalic: false, weights: [200, 300, 400, 500, 600, 700, 800, 900] },
  { category: 'monospace', family: 'JetBrains Mono', hasItalic: true, weights: [100, 200, 300, 400, 500, 600, 700, 800] },
  { category: 'monospace', family: 'VT323', hasItalic: false, weights: [400] },
  { category: 'monospace', family: 'Share Tech Mono', hasItalic: false, weights: [400] },
  { category: 'monospace', family: 'Courier Prime', hasItalic: true, weights: [400, 700] },
  { category: 'monospace', family: 'Anonymous Pro', hasItalic: true, weights: [400, 700] },
  { category: 'monospace', family: 'Cutive Mono', hasItalic: false, weights: [400] },
  { category: 'monospace', family: 'Overpass Mono', hasItalic: false, weights: [300, 400, 600, 700] }
];

const WEIGHT_LABEL_KEYS: Record<number, string> = {
  100: 'collaborative.font_weight_100',
  200: 'collaborative.font_weight_200',
  300: 'collaborative.font_weight_300',
  400: 'collaborative.font_weight_400',
  500: 'collaborative.font_weight_500',
  600: 'collaborative.font_weight_600',
  700: 'collaborative.font_weight_700',
  800: 'collaborative.font_weight_800',
  900: 'collaborative.font_weight_900',
};

const loadedFontHrefs = new Set<string>();

function loadGoogleFont(family: string, weights?: number[], italic?: boolean): Promise<void> {
  const font = GOOGLE_FONTS_CATALOG.find((f) => f.family.toLowerCase() === family.toLowerCase());
  const actualWeights = weights && weights.length > 0 ? weights : (font ? font.weights : [400, 700]);
  const hasItalic = italic ?? (font?.hasItalic ?? false);

  const formattedFamily = family.trim().replace(/ /g, '+');
  let url = '';
  if (hasItalic) {
    const weightSpecs = actualWeights.flatMap((w) => [`0,${w}`, `1,${w}`]).join(';');
    url = `https://fonts.googleapis.com/css2?family=${formattedFamily}:ital,wght@${weightSpecs}&display=swap`;
  } else {
    url = `https://fonts.googleapis.com/css2?family=${formattedFamily}:wght@${actualWeights.join(';')}&display=swap`;
  }

  if (loadedFontHrefs.has(url)) return Promise.resolve();
  loadedFontHrefs.add(url);

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLLinkElement>(`link[href="${url}"]`);
    if (existing) {
      resolve();
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

function loadGoogleFontPreview(family: string): void {
  const formattedFamily = family.trim().replace(/ /g, '+');
  const url = `https://fonts.googleapis.com/css2?family=${formattedFamily}:wght@400&display=swap`;
  if (loadedFontHrefs.has(url)) return;
  loadedFontHrefs.add(url);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}

export { GOOGLE_FONTS_CATALOG, WEIGHT_LABEL_KEYS, loadGoogleFont, loadGoogleFontPreview };
export type { GoogleFontItem };
