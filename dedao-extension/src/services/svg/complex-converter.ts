import { DOMParser } from 'xmldom';

export interface HtmlEle {
    x: string;
    y: string;
    id: string;
    width: string;
    height: string;
    offset: string;
    href: string;
    name: string;
    style: string;
    content: string;
    class: string;
    alt: string;
    len: string;
    newline: boolean;
    isBold: boolean;
    isItalic: boolean;
    isFn: boolean; // Superscript/footnote marker
    isSub: boolean;
    isFootnoteImage: boolean;
    fn: {
        href: string;
        style: string;
    };
    textAlign: string;
}

export interface ConvertedPage {
    html: string;
    images: string[];
    footnoteIconUrl?: string;
}

const FOOT_NOTE_IMG_W = 20;
const REQ_EBOOK_PAGE_WIDTH = 60000;

export class ComplexSvgConverter {
    private domParser: DOMParser;
    private chapterIndex: number = 0; // For footnote-{index}-{i} format like Go
    private tocLevel: Map<string, number> = new Map();
    private fnA: string = '';
    private fnB: string = '';

    // Persistent state across pages of a chapter to match Go package-level variables
    private lastY: string = "";
    private lastTop: string = "";
    private lastH: string = "";
    private lastName: string = "";

    constructor(chapterIndex?: number, tocLevel?: Map<string, number>) {
        this.domParser = new DOMParser();
        this.chapterIndex = chapterIndex || 0;
        this.tocLevel = tocLevel || new Map();
    }

    setChapterIndex(index: number) {
        this.chapterIndex = index;
        // Reset state for new chapter conversion
        this.lastY = "";
        this.lastTop = "";
        this.lastH = "";
        this.lastName = "";
    }

    setFnDelimiters(fnA: string, fnB: string) {
        this.fnA = fnA;
        this.fnB = fnB;
    }

    setTocLevel(tocLevel: Map<string, number>) {
        this.tocLevel = tocLevel;
    }

    public parseSvg(svgString: string): Document {
        return this.domParser.parseFromString(svgString, 'image/svg+xml');
    }

    convert(svgString: string, chapterId: string): ConvertedPage {
        const doc = this.domParser.parseFromString(svgString, 'image/svg+xml');
        const lineContent = this.genLineContentByElement(doc);
        return this.generateHtmlFromLines(lineContent, chapterId);
    }

    private genLineContentByElement(doc: Document): Map<number, HtmlEle[]> {
        const lineContent = new Map<number, HtmlEle[]>();
        const svg = doc.documentElement;
        const children = Array.from(svg.childNodes) as Element[];

        let offset = '';

        for (let k = 0; k < children.length; k++) {
            const child = children[k];
            if (child.nodeType !== 1) continue;

            const ele: HtmlEle = {
                x: child.getAttribute('x') || '0',
                y: child.getAttribute('y') || '0',
                id: '',
                width: child.getAttribute('width') || '0',
                height: child.getAttribute('height') || '0',
                offset: '',
                href: child.getAttribute('href') || child.getAttribute('xlink:href') || '',
                name: child.tagName,
                style: child.getAttribute('style') || '',
                content: '',
                class: child.getAttribute('class') || '',
                alt: child.getAttribute('alt') || '',
                len: child.getAttribute('len') || '',
                newline: child.getAttribute('newline') === 'true',
                isBold: false,
                isItalic: false,
                isFn: false,
                isSub: false,
                isFootnoteImage: false,
                fn: { href: '', style: '' },
                textAlign: ''
            };

            if (child.tagName === 'text') {
                const aTags = Array.from(child.getElementsByTagName('a'));
                if (aTags.length > 0) {
                    for (const a of aTags) {
                        ele.content += a.textContent || "";
                        ele.fn.href = a.getAttribute('href') || "";
                        ele.fn.style = a.getAttribute('style') || "";
                    }
                } else {
                    ele.content = child.textContent || "";
                }

                if (ele.content === "") {
                    const rects = child.getElementsByTagName('rect');
                    if (rects.length > 0) {
                        ele.content = " ";
                    } else {
                        ele.content = "&nbsp;";
                    }
                }

                const topAttr = child.getAttribute('top');
                if (topAttr) {
                    const topVal = parseFloat(topAttr);
                    const heightVal = parseFloat(ele.height || "0");
                    const lastTopVal = parseFloat(this.lastTop || "0");
                    const lastHVal = parseFloat(this.lastH || "0");

                    const isNumericOrMath = (s: string) => /^[0-9+\-*/^()\[\]{}.,=<>≤≥±≠≈~%‰°′″\s]+$/.test(s);
                    
                    // Logic from Go: detect possible super/sub
                    let isPossibleSuperOrSub = false;

                    // Check for font-size indicators (11-13px)
                    if (ele.style.includes('font-size:11px') || ele.style.includes('font-size:12px') || ele.style.includes('font-size:13px')) {
                        isPossibleSuperOrSub = true;
                    }

                    if (!isPossibleSuperOrSub && (lastHVal > 0) && (heightVal < lastHVal * 0.8)) {
                        if (child.tagName === this.lastName || (ele.content !== "" && ele.content.length <= 3 && isNumericOrMath(ele.content))) {
                            isPossibleSuperOrSub = true;
                        }
                    }

                    // Check Y-coord difference (baseline shift)
                    const yVal = parseFloat(ele.y);
                    const lastYVal = parseFloat(this.lastY);
                    if (!isPossibleSuperOrSub && yVal !== 0 && lastYVal !== 0 && yVal < lastYVal && (lastYVal - yVal > 2)) {
                        isPossibleSuperOrSub = true;
                    }

                    if (isPossibleSuperOrSub) {
                        const isLikelyPower = (ele.content !== "" && ele.content.length <= 3 && isNumericOrMath(ele.content)) || 
                                            (ele.content.length <= 5 && (ele.style.includes('font-size:11px') || ele.style.includes('font-size:12px') || ele.style.includes('font-size:13px')));
                        
                        if (isLikelyPower) {
                            if (topVal < lastTopVal) {
                                ele.isFn = true;
                            } else {
                                ele.isSub = true;
                            }
                            ele.newline = false;
                        } else {
                            // If it's NOT a numeric/math power, it's just normal text (maybe first char of para)
                            // Update lastTop/lastH but don't set isFn/isSub
                            this.lastTop = topAttr;
                            this.lastH = ele.height;
                        }
                    } else {
                        this.lastTop = topAttr;
                        this.lastH = ele.height;
                    }
                }
            }

            const idAttr = child.getAttribute('id');
            if (idAttr) {
                ele.id = idAttr;
                const offsetAttr = child.getAttribute('offset');
                if (offsetAttr) {
                    offset = offsetAttr;
                }
            }
            ele.offset = offset;

            ele.style = ele.style.replace(/fill/g, 'color');
            if (ele.style.includes('font-weight: bold;')) ele.isBold = true;
            if (ele.style.includes('font-style: oblique') || ele.style.includes('font-style: italic')) ele.isItalic = true;

            const wVal = parseFloat(ele.width || "0");
            if (child.tagName === 'image' && wVal > 0 && wVal < FOOT_NOTE_IMG_W && this.lastY) {
                ele.y = this.lastY;
            }

            if (ele.isFn || ele.isSub) {
                ele.y = this.lastY;
            }

            const yVal = parseFloat(ele.y);
            if (!isNaN(yVal) && (child.tagName === 'text' || child.tagName === 'image')) {
                if (!lineContent.has(yVal)) {
                    lineContent.set(yVal, []);
                }
                lineContent.get(yVal)?.push(ele);
                if (child.tagName === 'text' && !(ele.isFn || ele.isSub)) {
                    this.lastY = ele.y;
                }
            }
            
            this.lastName = child.tagName;
        }

        return lineContent;
    }

    private generateHtmlFromLines(lineContent: Map<number, HtmlEle[]>, chapterId: string): ConvertedPage {
        let result = `\n<div id="${chapterId}">\n`;
        const images: string[] = [];
        let footnoteIconUrl: string | undefined;
        // Track whether a div.part has been opened so footnote <aside> elements
        // are always placed inside a part container (T009 fix).
        let partOpened = false;
        let pendingFootnotes = '';

        const keys = Array.from(lineContent.keys()).sort((a, b) => a - b);

        for (const v of keys) {
            const lineItems = lineContent.get(v)!;
            let cont = '', id = '', contWOTag = '';
            let lineStyle = '';
            let firstX = 0;
            // Collect <aside> footnotes produced during this line's processing.
            // They will be flushed into result only after we know whether a part
            // is open, so they always land inside div.part.
            let lineFootnotes = '';
            // 跟踪当前正在开放的 fn 分组 span 的 style。
            // 当连续 fn 项共享相同 style 时，合并进同一个 <span>；style 变化或遇到非文本项时关闭。
            let fnSpanStyle = '';

            if (lineItems[0].id) {
                id = lineItems[0].id;
            }

            const lastIndex = lineItems.length - 1;
            if (lineItems[lastIndex].name !== 'image') {
                lineStyle = lineItems[lastIndex].style;
            } else if (lastIndex - 1 >= 0) {
                lineStyle = lineItems[lastIndex - 1].style;
            } else {
                lineStyle = lineItems[0].style;
            }

            const centerL = (REQ_EBOOK_PAGE_WIDTH / 2) * 0.9;
            const centerH = (REQ_EBOOK_PAGE_WIDTH / 2) * 1.1;
            const rightL = REQ_EBOOK_PAGE_WIDTH * 0.9;

            for (let i = 0; i < lineItems.length; i++) {
                const item = lineItems[i];
                let style = item.style;

                if (i === 0) {
                    firstX = parseFloat(item.x);
                }

                const w = parseFloat(item.width || "0");

                if (item.name === 'image') {
                    // 图片 item 不属于 fn 分组，关闭任何正在开放的 fn span
                    if (fnSpanStyle) {
                        cont += '</span>';
                        fnSpanStyle = '';
                    }
                    if (firstX >= centerL && firstX <= centerH) {
                        style += "display: block;text-align:center;";
                    } else if (firstX >= rightL) {
                        style += "display: block;text-align:right;";
                    }

                    const placeholder = `__IMG_PLACEHOLDER_${encodeURIComponent(item.href)}__`;
                    let imgTag = `<img width="${Math.round(w)}" src="${placeholder}" alt="${this.escapeAttr(item.alt)}"/>`;
                    
                    if (w < FOOT_NOTE_IMG_W) {
                        if (style) {
                            imgTag = `<span style="${this.escapeAttr(style)}">${imgTag}</span>`;
                        }
                        if (item.class) {
                            const footnoteId = `footnote-${this.chapterIndex}-${i}`;
                            const footnoteContentId = `${footnoteId}-content`;
                            imgTag = `<sup><a class="duokan-footnote" epub:type="noteref" href="#${footnoteId}"> <img width="${Math.round(w)}" src="${placeholder}" alt="${this.escapeAttr(item.alt)}" zy-footnote="${this.escapeAttr(item.alt)}" class="${item.class} zhangyue-footnote qqreader-footnote"/></a></sup>`;
                            // Accumulate into lineFootnotes instead of result so we can
                            // guarantee placement inside div.part after the heading opens it.
                            lineFootnotes += `<aside epub:type="footnote" id="${footnoteId}"><ol class="duokan-footnote-content" style="list-style:none;padding:0px;margin:0px;"><li class="duokan-footnote-item" id="${footnoteContentId}">${this.escapeHtml(item.alt)}</li></ol></aside>`;
                            cont += imgTag;
                            if (!footnoteIconUrl) footnoteIconUrl = item.href;
                        } else {
                            cont += imgTag;
                        }
                    } else {
                        if (style) {
                            imgTag = `<div style="${this.escapeAttr(style)}">${imgTag}</div>`;
                        }
                        // Large image: add directly to result (sibling of paragraph)
                        result += '\n' + imgTag;
                    }
                    images.push(item.href);
                } else if (item.name === 'text') {
                    const escapedContent = this.escapeHtml(item.content);

                    // fn 项（如 [1]）可能有独立样式（蓝色），与行整体 lineStyle 不同。
                    // 通过跟踪 fnSpanStyle 将连续同色 fn 项合并进同一个 <span>，
                    // 与 Go 版本行为一致（一组脚注引用共享一个外层 span）。
                    const itemFnSpanStyle =
                        item.fn.href && item.style && item.style !== lineStyle ? item.style : '';
                    if (fnSpanStyle !== itemFnSpanStyle) {
                        if (fnSpanStyle) cont += '</span>';
                        if (itemFnSpanStyle) cont += `<span style="${this.escapeAttr(itemFnSpanStyle)}">`;
                        fnSpanStyle = itemFnSpanStyle;
                    }

                    const tags = [
                        { condition: item.isBold, open: '<b>', close: '</b>' },
                        { condition: item.isItalic, open: '<i>', close: '</i>' },
                        { condition: item.isFn, open: '<sup>', close: '</sup>' },
                        { condition: item.isSub, open: '<sub>', close: '</sub>' },
                    ];

                    for (const tag of tags) {
                        if (tag.condition) cont += tag.open;
                    }

                    if (item.fn.href) {
                        cont += `<a id="${item.id}" href="${item.fn.href}"`;
                        if (item.fn.style) {
                            cont += ` style="${this.escapeAttr(item.fn.style)}"`;
                        }
                        cont += '>';
                    }

                    cont += escapedContent;

                    if (item.fn.href) {
                        cont += '</a>';
                    }

                    for (let j = tags.length - 1; j >= 0; j--) {
                        if (tags[j].condition) cont += tags[j].close;
                    }

                    contWOTag += item.content;
                }

                if (i === lineItems.length - 1) {
                    // 行末：关闭任何尚未关闭的 fn 分组 span
                    if (fnSpanStyle) {
                        cont += '</span>';
                        fnSpanStyle = '';
                    }

                    let matchH = false;
                    const unescapedContWOTag = this.unescapeHtml(contWOTag);

                    let level = 0;
                    const contWOTagMatch = unescapedContWOTag.replace(/&nbsp;/g, '').replace(/ /g, '').trim();
                    for (const [k, v] of this.tocLevel) {
                        if (k.replace(/ /g, '').includes(contWOTagMatch)) {
                            matchH = true;
                            level = v;
                            break;
                        }
                    }

                    if (contWOTag) {
                        if (matchH) {
                            result += '\n</div>';
                            result += `<div class="header${level}">${this.genTocLevelHtml(level, true)}`;
                        } else {
                            // 在 <p> 之前先 flush 当前行的 footnote asides，
                            // 与 Go 版本行为一致（aside 出现在引用它的段落之前）
                            if (partOpened && lineFootnotes) {
                                result += lineFootnotes;
                                lineFootnotes = '';
                            }
                            result += '\n\t<p>';
                        }
                    }

                    // 对居中 heading，追加 display+text-align 以匹配 Go 版本输出
                    let effectiveLineStyle = lineStyle;
                    if (matchH && firstX >= centerL && firstX <= centerH) {
                        effectiveLineStyle += 'display: block;text-align:center;';
                    }

                    if (cont) {
                        if (id && effectiveLineStyle) {
                            result += `<span id="${id}" style="${this.escapeAttr(effectiveLineStyle)}">${cont}</span>`;
                        } else if (id) {
                            result += `<span id="${id}">${cont}</span>`;
                        } else if (effectiveLineStyle) {
                            result += `<span style="${this.escapeAttr(effectiveLineStyle)}">${cont}</span>`;
                        } else {
                            result += cont;
                        }
                    }

                    if (contWOTag) {
                        if (matchH) {
                            result += `${this.genTocLevelHtml(level, false)}</div>\n<div class="part">`;
                            // A new div.part just opened; flush any footnotes that
                            // accumulated before the first heading was seen.
                            partOpened = true;
                            if (pendingFootnotes) {
                                result += pendingFootnotes;
                                pendingFootnotes = '';
                            }
                        } else {
                            result += '</p>';
                        }
                    }

                    // Route footnotes produced by this line to the correct place.
                    // If a part is already open they can go directly into result;
                    // otherwise buffer them until the next part opens.
                    if (lineFootnotes) {
                        if (partOpened) {
                            result += lineFootnotes;
                        } else {
                            pendingFootnotes += lineFootnotes;
                        }
                    }
                }
            }
        }

        // If the page contains no headings (no div.part was ever opened) but
        // there are still buffered footnotes, write them out as a fallback so
        // they are not silently dropped.
        if (pendingFootnotes) {
            result += pendingFootnotes;
        }

        result += '</div>\n';

        return { html: result, images, footnoteIconUrl };
    }

    private genTocLevelHtml(level: number, isOpen: boolean): string {
        const tag = level === 0 ? 'h1' : `h${level + 1}`;
        return isOpen ? `<${tag}>` : `</${tag}>`;
    }

    private escapeHtml(unsafe: string): string {
        return (unsafe || '')
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    private unescapeHtml(safe: string): string {
        return (safe || '')
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, "\"")
            .replace(/&#039;/g, "'");
    }

    private escapeAttr(unsafe: string): string {
        return (unsafe || '')
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
}
