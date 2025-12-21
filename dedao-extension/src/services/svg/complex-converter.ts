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

    constructor(chapterIndex?: number, tocLevel?: Map<string, number>) {
        this.domParser = new DOMParser();
        this.chapterIndex = chapterIndex || 0;
        this.tocLevel = tocLevel || new Map();
    }

    setChapterIndex(index: number): void {
        this.chapterIndex = index;
    }

    setTocLevel(tocLevel: Map<string, number>): void {
        this.tocLevel = tocLevel;
    }

    setFnDelimiters(fnA: string, fnB: string): void {
        this.fnA = fnA;
        this.fnB = fnB;
    }

    parseSvg(svgString: string): Document {
        return this.domParser.parseFromString(svgString, 'image/svg+xml');
    }

    convert(svgString: string, chapterId: string): ConvertedPage {
        const doc = this.domParser.parseFromString(svgString, 'image/svg+xml');
        const root = doc.documentElement;
        if (!root) {
            return { html: '', images: [] };
        }

        const lineContent = this.genLineContentByElement(chapterId, root);
        return this.generateHtmlFromLines(lineContent, chapterId);
    }

    private genLineContentByElement(chapterId: string, element: Element): Map<number, HtmlEle[]> {
        const lineContent = new Map<number, HtmlEle[]>();
        let offset = "";
        let lastY = "";
        let lastTop = "";
        let lastH = "";
        let lastName = "";

        const children = Array.from(element.childNodes).filter(node => node.nodeType === 1) as Element[];

        for (let k = 0; k < children.length; k++) {
            const child = children[k];
            
            const yAttr = child.getAttribute('y');
            if (!yAttr && child.tagName !== 'image') {
                continue;
            }

            const ele: HtmlEle = this.createEmptyHtmlEle();
            
            ele.x = child.getAttribute('x') || "";
            ele.y = yAttr || "";
            ele.width = child.getAttribute('width') || "";
            ele.height = child.getAttribute('height') || "";
            ele.class = child.getAttribute('class') || "";
            ele.style = child.getAttribute('style') || "";
            ele.name = child.tagName;

            if (child.tagName === 'image') {
                ele.href = child.getAttribute('xlink:href') || child.getAttribute('href') || "";
                ele.alt = child.getAttribute('alt') || "";
            } else if (child.tagName === 'text') {
                const textContent = child.textContent || "";
                if (textContent !== "") {
                    ele.content = textContent;
                } else {
                    const aTags = Array.from(child.getElementsByTagName('a'));
                    if (aTags.length > 0) {
                        for (const a of aTags) {
                            ele.content += a.textContent || "";
                            const href = a.getAttribute('href') || "";
                            if (href) {
                                const parts = href.split('/');
                                let finalHref = parts[parts.length - 1];
                                const tagParts = finalHref.split('#');
                                if (tagParts.length > 1) {
                                    if (this.fnA && tagParts[1].includes(this.fnA)) {
                                        ele.fn.href = "#" + tagParts[0] + "_" + tagParts[1].replace(new RegExp(this.fnA, 'g'), this.fnB);
                                    } else if (this.fnB && tagParts[1].includes(this.fnB)) {
                                        ele.fn.href = "#" + tagParts[0] + "_" + tagParts[1].replace(new RegExp(this.fnB, 'g'), this.fnA);
                                    } else {
                                        ele.fn.href = "#" + tagParts[0] + "_" + tagParts[1];
                                    }
                                    ele.id = chapterId + "_" + tagParts[1];
                                } else {
                                    ele.fn.href = "#" + tagParts[0];
                                    ele.id = chapterId;
                                }
                                ele.fn.style = a.getAttribute('style') || "";
                            }
                        }
                    } else {
                        ele.content = "&nbsp;";
                    }
                }

                const topAttr = child.getAttribute('top');
                if (topAttr) {
                    const topVal = parseFloat(topAttr);
                    const heightVal = parseFloat(ele.height || "0");
                    const lastTopVal = parseFloat(lastTop || "0");
                    const lastHVal = parseFloat(lastH || "0");

                    const isNumericOrMath = (s: string) => /^[0-9+\-*/^()\[\]{}.,]+$/.test(s);
                    
                    // Logic from Go: detect possible super/sub
                    let isPossibleSuperOrSub = (lastHVal > 0) && (heightVal < lastHVal * 0.8) && 
                        (child.tagName === lastName || (ele.content !== "" && ele.content.length <= 3 && isNumericOrMath(ele.content)));

                    // Check for font-size indicators (11-13px)
                    if (ele.style.includes('font-size:11px') || ele.style.includes('font-size:12px') || ele.style.includes('font-size:13px')) {
                        isPossibleSuperOrSub = true;
                    }

                    // Check Y-coord difference (baseline shift)
                    const yVal = parseFloat(ele.y);
                    const lastYVal = parseFloat(lastY);
                    if (yVal !== 0 && lastYVal !== 0 && yVal < lastYVal && (lastYVal - yVal > 2)) {
                        isPossibleSuperOrSub = true;
                    }

                    if (isPossibleSuperOrSub) {
                        const isLikelyPower = (ele.content !== "" && ele.content.length <= 3 && isNumericOrMath(ele.content));
                        // Note: Go has an extra check for lenInt <= 5 && fontSizeIsSmaller, 
                        // but ele.content is already filtered.
                        
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
                            lastTop = topAttr;
                            lastH = ele.height;
                        }
                    } else {
                        lastTop = topAttr;
                        lastH = ele.height;
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
            if (child.tagName === 'image' && wVal > 0 && wVal < FOOT_NOTE_IMG_W && lastY) {
                ele.y = lastY;
            }

            const yVal = parseFloat(ele.y);
            if (!isNaN(yVal) && (child.tagName === 'text' || child.tagName === 'image')) {
                if (!lineContent.has(yVal)) {
                    lineContent.set(yVal, []);
                }
                lineContent.get(yVal)?.push(ele);
                lastY = ele.y;
            }
            
            lastName = child.tagName;
        }

        return lineContent;
    }

    private generateHtmlFromLines(lineContent: Map<number, HtmlEle[]>, chapterId: string): ConvertedPage {
        let result = '';
        const images: string[] = [];
        let footnoteIconUrl: string | undefined;

        const keys = Array.from(lineContent.keys()).sort((a, b) => a - b);

        for (const v of keys) {
            const lineItems = lineContent.get(v)!;
            let cont = '', id = '', contWOTag = '';
            let lineStyle = '';
            const firstX = parseFloat(lineItems[0].x);

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

                const w = parseFloat(item.width || "0");

                if (item.name === 'image') {
                    if (firstX >= centerL && firstX <= centerH) {
                        style += "display: block;text-align:center;";
                    } else if (firstX >= rightL) {
                        style += "display: block;text-align:right;";
                    }

                    const placeholder = `__IMG_PLACEHOLDER_${encodeURIComponent(item.href)}__`;
                    let imgTag = `<img width="${Math.round(w)}" src="${placeholder}" alt="${this.escapeAttr(item.alt)}"/>`;
                    if (style) {
                        imgTag = `<div style="${this.escapeAttr(style)}">${imgTag}</div>`;
                    }

                    if (w < FOOT_NOTE_IMG_W) {
                        if (item.class) {
                            const footnoteId = `footnote-${this.chapterIndex}-${i}`;
                            imgTag = `<sup><a class="duokan-footnote" epub:type="noteref" href="#${footnoteId}"> <img width="${Math.round(w)}" src="${placeholder}" alt="${this.escapeAttr(item.alt)}" zy-footnote="${this.escapeAttr(item.alt)}" class="${item.class} zhangyue-footnote qqreader-footnote"/></a></sup>`;
                            result += `<aside epub:type="footnote" id="${footnoteId}"><ol class="duokan-footnote-content" style="list-style:none;padding:0px;margin:0px;"><li class="duokan-footnote-item" id="${footnoteId}">${this.escapeHtml(item.alt)}</li></ol></aside>`;
                            cont += imgTag;
                            if (!footnoteIconUrl) footnoteIconUrl = item.href;
                        } else {
                            cont += imgTag;
                        }
                    } else {
                        // Large image: add directly to result (sibling of paragraph)
                        result += '\n' + imgTag;
                    }
                    images.push(item.href);
                } else if (item.name === 'text') {
                    const escapedContent = this.escapeHtml(item.content);

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
                            result += `\n<div class="header${level}">${this.genTocLevelHtml(level, true)}`;
                        } else {
                            result += '\n\t<p>';
                        }
                    }

                    if (cont) {
                        if (id && lineStyle) {
                            result += `<span id="${id}" style="${this.escapeAttr(lineStyle)}">`;
                        } else {
                            if (id) result += `<span id="${id}">`;
                            if (lineStyle) result += `<span style="${this.escapeAttr(lineStyle)}">`;
                        }
                        result += cont + '</span>';
                    }

                    if (contWOTag) {
                        if (matchH) {
                            result += `${this.genTocLevelHtml(level, false)}</div>\n<div class="part">`;
                        } else {
                            result += '</p>';
                        }
                    }
                }
            }
        }

        return { html: result, images, footnoteIconUrl };
    }

    private genTocLevelHtml(level: number, isOpen: boolean): string {
        const tag = level === 0 ? 'h1' : `h${Math.min(level + 1, 6)}`;
        return isOpen ? `<${tag}>` : `</${tag}>`;
    }

    private createEmptyHtmlEle(): HtmlEle {
        return {
            x: "", y: "", id: "", width: "", height: "", offset: "",
            href: "", name: "", style: "", content: "", class: "", alt: "", len: "",
            newline: false, isBold: false, isItalic: false, isFn: false, isSub: false, isFootnoteImage: false,
            fn: { href: "", style: "" }, textAlign: ""
        };
    }

    private escapeHtml(unsafe: string): string {
        return (unsafe || '')
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    private unescapeHtml(safe: string): string {
        return (safe || '')
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ');
    }

    private escapeAttr(unsafe: string): string {
        return (unsafe || '')
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;");
    }
}
