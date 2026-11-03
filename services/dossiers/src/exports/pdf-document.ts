const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 50;
const FOOTER_Y = 36;
/** Largeur moyenne d'un caractère Helvetica, en fraction du corps (majorée pour ne jamais déborder). */
const CHAR_WIDTH = 0.54;

/** Caractères hors Latin-1 présents dans WinAnsi (codes de la page Windows-1252). */
const WIN_ANSI: Record<string, number> = {
  '’': 0x92,
  '‘': 0x91,
  '“': 0x93,
  '”': 0x94,
  '–': 0x96,
  '—': 0x97,
  '…': 0x85,
  '€': 0x80,
  '•': 0x95,
};

/** Style d'une ligne de texte. */
export interface TextStyle {
  size?: number;
  bold?: boolean;
  /** Retrait à gauche en points. */
  indent?: number;
}

interface Line {
  text: string;
  size: number;
  bold: boolean;
  indent: number;
  y: number;
}

/** Texte encodé en WinAnsi, échappé pour une chaîne littérale PDF (octets > 127 en octal). */
function literal(text: string): string {
  let out = '';
  for (const char of text) {
    const code = WIN_ANSI[char] ?? char.codePointAt(0) ?? 63;
    const byte = code > 255 ? 63 : code;
    if (char === '(' || char === ')' || char === '\\') out += `\\${char}`;
    else if (byte < 32 || byte > 126) out += `\\${byte.toString(8).padStart(3, '0')}`;
    else out += String.fromCharCode(byte);
  }
  return `(${out})`;
}

/**
 * Générateur de PDF minimal (Helvetica, texte uniquement) : saut de page automatique, retour à la
 * ligne, pied de page répété avec numérotation. Les flux ne sont pas compressés, ce qui garde le
 * fichier lisible par les outils d'extraction de texte.
 */
export class PdfDocument {
  private readonly pages: Line[][] = [[]];
  private y = PAGE_HEIGHT - MARGIN;

  constructor(
    private readonly title: string,
    private readonly footer: (page: number, pages: number) => string[],
  ) {}

  /** Ajoute un texte, coupé aux mots pour tenir dans la largeur utile. */
  text(text: string, style: TextStyle = {}): void {
    const size = style.size ?? 10;
    const bold = style.bold ?? false;
    const indent = style.indent ?? 0;
    const maxChars = Math.max(10, Math.floor((PAGE_WIDTH - 2 * MARGIN - indent) / (size * CHAR_WIDTH)));
    for (const line of wrap(text, maxChars)) this.push(line, size, bold, indent);
  }

  /** Titre de section. */
  heading(text: string): void {
    this.space(8);
    this.text(text, { size: 13, bold: true });
    this.space(2);
  }

  /** Espace vertical. */
  space(points: number): void {
    this.y -= points;
  }

  /** Assemble le fichier PDF. */
  build(): Buffer {
    const total = this.pages.length;
    const objects: string[] = [];
    const add = (body: string): number => objects.push(body);
    add('<< /Type /Catalog /Pages 2 0 R >>');
    const kids = this.pages.map((_, index) => `${5 + index * 2} 0 R`).join(' ');
    add(`<< /Type /Pages /Kids [${kids}] /Count ${total} >>`);
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    this.pages.forEach((lines, index) => {
      const content = this.content(lines, index + 1, total);
      add(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + index * 2} 0 R >>`,
      );
      add(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
    });
    const info = add(`<< /Title ${literal(this.title)} /Producer (HYGIA) >>`);
    let file = '%PDF-1.4\n';
    const offsets: number[] = [];
    objects.forEach((body, index) => {
      offsets.push(Buffer.byteLength(file, 'latin1'));
      file += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = Buffer.byteLength(file, 'latin1');
    file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) file += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    file += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(file, 'latin1');
  }

  private push(text: string, size: number, bold: boolean, indent: number): void {
    const height = size * 1.35;
    this.y -= height;
    if (this.y < MARGIN + 30) {
      this.pages.push([]);
      this.y = PAGE_HEIGHT - MARGIN - height;
    }
    this.pages[this.pages.length - 1]!.push({ text, size, bold, indent, y: this.y });
  }

  private content(lines: Line[], page: number, pages: number): string {
    const parts: string[] = ['BT'];
    const place = (text: string, size: number, bold: boolean, x: number, y: number): void => {
      parts.push(`/${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x} ${y.toFixed(1)} Tm ${literal(text)} Tj`);
    };
    for (const line of lines) {
      place(line.text, line.size, line.bold, MARGIN + line.indent, line.y);
    }
    const footer = this.footer(page, pages);
    footer.forEach((text, index) => {
      place(text, 8, false, MARGIN, FOOTER_Y + (footer.length - 1 - index) * 11);
    });
    parts.push('ET');
    return parts.join('\n');
  }
}

/** Coupe un texte aux espaces en lignes d'au plus `max` caractères (un mot trop long est coupé). */
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let current = '';
    for (let word of paragraph.split(/\s+/).filter(Boolean)) {
      while (word.length > max) {
        if (current) lines.push(current);
        lines.push(word.slice(0, max));
        word = word.slice(max);
        current = '';
      }
      if (current && current.length + 1 + word.length > max) {
        lines.push(current);
        current = word;
      } else {
        current = current ? `${current} ${word}` : word;
      }
    }
    lines.push(current);
  }
  return lines;
}
