// @vitest-environment happy-dom

import type Content from '../block/base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

// Coverage for the programmatic block-editing API added for the
// muyajs -> @muyajs/core desktop migration: duplicate / insertParagraph /
// deleteParagraph. These drive the desktop Edit/Paragraph menu actions,
// which previously had no public entrypoint on @muyajs/core.
//
// Block-tree mutations dispatch json1 ops that flush to the document state on
// the next animation frame (see JSONState._emitStateChange), so assertions on
// getState() are wrapped in vi.waitFor to await that flush.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

// Block-level ops resolve their target via the active content block's
// outMostBlock — the way the editor tracks the cursor after a click. Set it
// directly to simulate the cursor sitting in the first block.
function placeCursorOnFirstBlock(muya: Muya): Content {
    const first = muya.editor.scrollPage!.firstContentInDescendant()!;
    muya.editor.activeContentBlock = first;
    return first;
}

// Place the cursor on the leaf content block whose text matches `text`, the way
// a click sets `activeContentBlock`. Used to exercise nested-block anchoring.
function placeCursorOn(muya: Muya, text: string): Content {
    let target: Content | null = null;
    const visit = (block: { text?: string; constructor: { blockName?: string }; children?: { forEach: (cb: (b: unknown) => void) => void } }) => {
        if (
            (block.constructor as { blockName?: string }).blockName?.endsWith('.content')
            && block.text === text
        ) {
            target = block as unknown as Content;
        }
        block.children?.forEach(b => visit(b as typeof block));
    };
    visit(muya.editor.scrollPage as unknown as Parameters<typeof visit>[0]);
    if (!target)
        throw new Error(`content block with text "${text}" not found`);
    muya.editor.activeContentBlock = target;
    return target;
}

describe('muya block editing api', () => {
    it('duplicate() copies the current block in place', async () => {
        const muya = bootMuya('# Title\n\nbody\n');
        placeCursorOnFirstBlock(muya);
        muya.duplicate();
        await vi.waitFor(() => {
            const after = muya.getState();
            expect(after.length).toBe(3);
            expect(after[0].name).toBe('atx-heading');
            expect(after[1].name).toBe('atx-heading');
            expect(after[2].name).toBe('paragraph');
        });
    });

    it('insertParagraph() inserts an empty paragraph after by default', async () => {
        const muya = bootMuya('# Title\n');
        placeCursorOnFirstBlock(muya);
        muya.insertParagraph();
        await vi.waitFor(() => {
            const after = muya.getState();
            expect(after.length).toBe(2);
            expect(after[0].name).toBe('atx-heading');
            expect(after[1].name).toBe('paragraph');
        });
    });

    it('insertParagraph("before", text) inserts before with the given text', async () => {
        const muya = bootMuya('# Title\n');
        placeCursorOnFirstBlock(muya);
        muya.insertParagraph('before', 'intro');
        await vi.waitFor(() => {
            const after = muya.getState();
            expect(after.length).toBe(2);
            expect(after[0].name).toBe('paragraph');
            expect(after[1].name).toBe('atx-heading');
        });
        expect(muya.getMarkdown()).toContain('intro');
    });

    it('insertParagraph("after", text, true) anchors at the outermost block in nested structures', async () => {
        // The explicit "Create Paragraph Below" caller passes outMost=true, so a
        // cursor inside a blockquote inserts the new paragraph AFTER the whole
        // blockquote at document root — not as an inner sibling.
        const muya = bootMuya('> quoted line\n');
        placeCursorOn(muya, 'quoted line');
        muya.insertParagraph('after', 'OUTERSIBLING', true);
        await vi.waitFor(() => {
            const after = muya.getState();
            expect(after.length).toBe(2);
            expect(after[0].name).toBe('block-quote');
            expect(after[1].name).toBe('paragraph');
        });
        expect(muya.getMarkdown()).toContain('OUTERSIBLING');
    });

    it('deleteParagraph() removes the current block and keeps the rest', async () => {
        const muya = bootMuya('# Title\n\nbody\n');
        placeCursorOnFirstBlock(muya);
        muya.deleteParagraph();
        await vi.waitFor(() => {
            const after = muya.getState();
            expect(after.length).toBe(1);
            expect(after[0].name).toBe('paragraph');
        });
    });

    it('deleteParagraph() on the only block leaves a single empty paragraph', async () => {
        const muya = bootMuya('# Title\n');
        placeCursorOnFirstBlock(muya);
        muya.deleteParagraph();
        await vi.waitFor(() => {
            const after = muya.getState();
            expect(after.length).toBe(1);
            expect(after[0].name).toBe('paragraph');
        });
    });
});

describe('muya moveBlock()', () => {
    it('moves the current top-level block down past its next sibling', async () => {
        const muya = bootMuya('alpha\n\nbeta\n\ngamma\n');
        placeCursorOn(muya, 'alpha');
        muya.moveBlock('down');
        await vi.waitFor(() => {
            expect(muya.getMarkdown().trim()).toBe('beta\n\nalpha\n\ngamma');
        });
    });

    it('moves the current top-level block up past its previous sibling', async () => {
        const muya = bootMuya('# Title\n\nalpha\n\nbeta\n');
        placeCursorOn(muya, 'beta');
        muya.moveBlock('up');
        await vi.waitFor(() => {
            expect(muya.getMarkdown().trim()).toBe('# Title\n\nbeta\n\nalpha');
        });
    });

    it('is a no-op at the edge of the document', async () => {
        const muya = bootMuya('alpha\n\nbeta\n');
        placeCursorOn(muya, 'alpha');
        muya.moveBlock('up');
        placeCursorOn(muya, 'beta');
        muya.moveBlock('down');
        await new Promise(resolve => requestAnimationFrame(resolve));
        expect(muya.getMarkdown().trim()).toBe('alpha\n\nbeta');
    });

    it('reorders list items instead of blocks inside an item', async () => {
        const muya = bootMuya('- one\n- two\n- three\n');
        placeCursorOn(muya, 'three');
        muya.moveBlock('up');
        await vi.waitFor(() => {
            expect(muya.getMarkdown().trim()).toBe('- one\n- three\n- two');
        });
    });

    it('keeps nested list items within their own list', async () => {
        const muya = bootMuya('- parent\n  - child a\n  - child b\n- sibling\n');
        placeCursorOn(muya, 'child a');
        muya.moveBlock('down');
        await vi.waitFor(() => {
            expect(muya.getMarkdown().trim()).toBe('- parent\n  - child b\n  - child a\n- sibling');
        });
    });

    it('never moves a block above the front matter', async () => {
        const muya = bootMuya('---\ntitle: x\n---\n\nbody\n');
        placeCursorOn(muya, 'body');
        muya.moveBlock('up');
        await new Promise(resolve => requestAnimationFrame(resolve));
        expect(muya.getState()[0].name).toBe('frontmatter');
    });
});
