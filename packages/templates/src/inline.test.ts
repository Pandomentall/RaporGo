import { describe, expect, it } from 'vitest';
import { escapeHtml, renderInline, renderInlineBlock, serializeInline } from './inline.js';

describe('renderInline', () => {
  it('escapes before it formats, so markup in content cannot inject HTML', () => {
    expect(renderInline('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('renders the four supported constructs', () => {
    expect(renderInline('**kalın** ve *italik*')).toBe('<strong>kalın</strong> ve <em>italik</em>');
    expect(renderInline('`kod`')).toBe('<code>kod</code>');
    expect(renderInline('[bağ](https://raporgo.dev)')).toBe('<a href="https://raporgo.dev">bağ</a>');
  });

  it('leaves emphasis inside code spans alone', () => {
    expect(renderInline('`a*b*c`')).toBe('<code>a*b*c</code>');
  });

  it('drops links with an unsafe scheme rather than rendering them', () => {
    expect(renderInline('[x](javascript:alert(1))')).toContain('[x](javascript:alert(1))');
    expect(renderInline('[x](javascript:alert(1))')).not.toContain('<a');
  });

  it('splits blank lines into paragraph breaks', () => {
    expect(renderInlineBlock('bir\n\niki')).toBe('bir<br><br>iki');
  });
});

describe('serializeInline', () => {
  it('round-trips the markup the editor can produce', () => {
    for (const source of [
      'düz metin',
      '**kalın** ve *italik*',
      'bir `kod` parçası',
      '[bağ](https://raporgo.dev) burada',
      'Türkçe: çğıöşü ÇĞİÖŞÜ',
    ]) {
      expect(serializeInline(renderInline(source))).toBe(source);
    }
  });

  it('normalises what a browser leaves behind after editing', () => {
    expect(serializeInline('<b>kalın</b> ve <i>eğik</i>')).toBe('**kalın** ve *eğik*');
    expect(serializeInline('bir<div>iki</div>')).toBe('bir\niki');
    expect(serializeInline('a&nbsp;b')).toBe('a b');
    expect(serializeInline('<span style="color:red">renkli</span>')).toBe('renkli');
  });

  it('restores escaped characters to their literal form', () => {
    expect(serializeInline(renderInline('a & b < c'))).toBe('a & b < c');
  });
});

describe('inline colour', () => {
  it('renders a palette role as a themed variable and a hex as itself', () => {
    expect(renderInline('[dikkat]{danger}')).toBe(
      '<span class="rg-color" data-color="danger" style="color:var(--rg-danger)">dikkat</span>',
    );
    expect(renderInline('[x]{primaryAlt}')).toContain('var(--rg-primary-alt)');
    expect(renderInline('[x]{#C0392B}')).toBe('<span class="rg-color" data-color="#C0392B" style="color:#c0392b">x</span>');
  });

  it('leaves an unknown colour name alone rather than emitting a style', () => {
    expect(renderInline('[x]{mor}')).toBe('[x]{mor}');
    expect(renderInline('[x]{red;background:url(1)}')).toBe('[x]{red;background:url(1)}');
  });

  it('does not confuse colour with links and nests with emphasis', () => {
    expect(renderInline('[bağ](https://a.b) ve [renk]{accent}')).toBe(
      '<a href="https://a.b">bağ</a> ve <span class="rg-color" data-color="accent" style="color:var(--rg-accent)">renk</span>',
    );
    expect(renderInline('**[kalın]{danger}**')).toBe(
      '<strong><span class="rg-color" data-color="danger" style="color:var(--rg-danger)">kalın</span></strong>',
    );
  });
});

describe('serializeInline colours', () => {
  it('keeps the role from a stamped span or font and round-trips', () => {
    const markup = 'Bir [önemli]{danger} söz';
    expect(serializeInline(renderInline(markup))).toBe(markup);
    expect(serializeInline('<font color="#c0392b" data-color="danger">x</font>')).toBe('[x]{danger}');
  });

  it('turns a browser font tag or rgb style into a hex colour', () => {
    expect(serializeInline('a <font color="#FF0000">b</font> c')).toBe('a [b]{#ff0000} c');
    expect(serializeInline('<span style="color: rgb(192, 57, 43);">b</span>')).toBe('[b]{#c0392b}');
  });

  it('drops colour it cannot express instead of leaking markup', () => {
    expect(serializeInline('<font color="red">b</font>')).toBe('b');
    expect(serializeInline('<span data-color="mor">b</span>')).toBe('b');
  });

  it('keeps bold inside a colour and colour inside bold', () => {
    expect(serializeInline('<font color="#ff0000"><b>x</b></font>')).toBe('[**x**]{#ff0000}');
    expect(serializeInline('<b><font color="#ff0000">x</font></b>')).toBe('**[x]{#ff0000}**');
  });
});
