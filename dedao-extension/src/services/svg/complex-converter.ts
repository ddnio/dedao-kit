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
    isFootnoteImage: boolean; // New: To specifically mark small image as footnote reference
    fn: {
        href: string;
        style: string;
    };
    textAlign: string;
}

export interface ConvertedPage {
    html: string;
    images: string[];
    footnotes: { id: string, text: string }[]; // New: Collected footnote definitions
}

const FOOT_NOTE_IMG_W = 20;
const FOOT_NOTE_IMG_H = 20;
const REQ_EBOOK_PAGE_WIDTH = 60000;

export class ComplexSvgConverter {
    private domParser: DOMParser;
    private footnoteCounter: number = 0;
    private getNextFootnoteNum?: () => number;

    constructor(getNextFootnoteNum?: () => number) {
        this.domParser = new DOMParser();
        this.getNextFootnoteNum = getNextFootnoteNum;
    }

    convert(svgString: string, chapterId: string): ConvertedPage {
        // Preprocess to handle entities if needed, similar to Go's preprocessSvgContent
        // For now, assume content is valid XML/SVG
        const doc = this.domParser.parseFromString(svgString, 'image/svg+xml');
        
        // Find the root svg element or groups
        // dedao-dl uses svgparser which iterates children. 
        // We will look for 'g', 'text', 'image' at top level or nested.
        // Usually Dedao SVG is flat list of text/image under svg or g.
        
        // Let's get all relevant elements (text, image) and process them.
        // However, hierarchy matters for attributes. 
        // For simplicity, we assume a flat structure or iterate all descendants?
        // Go code iterates `element.Children`.
        
        const root = doc.documentElement;
        if (!root) {
            return { html: '', images: [], footnotes: [] };
        }

        const lineContent = this.genLineContentByElement(chapterId, root);
        return this.generateHtmlFromLines(lineContent, chapterId);
    }

    private genLineContentByElement(chapterId: string, element: Element): Map<number, HtmlEle[]> {
        const lineContent = new Map<number, HtmlEle[]>();
        let lastY = "";
        let lastTop = "";
        let lastH = "";
        let lastName = "";

        // Iterate over children
        const children = Array.from(element.childNodes).filter(node => node.nodeType === 1) as Element[];

        for (let k = 0; k < children.length; k++) {
            const child = children[k];
            const ele: HtmlEle = this.createEmptyHtmlEle();
            
            // Attributes
            ele.x = child.getAttribute('x') || "";
            ele.y = child.getAttribute('y') || "";
            ele.width = child.getAttribute('width') || "";
            ele.height = child.getAttribute('height') || "";
            ele.id = child.getAttribute('id') || "";
            ele.class = child.getAttribute('class') || "";
            ele.style = child.getAttribute('style') || "";
            ele.len = child.getAttribute('len') || "";
            ele.offset = child.getAttribute('offset') || "";
            
            const topAttr = child.getAttribute('top') || "";
            const newlineAttr = child.getAttribute('newline');
            ele.newline = newlineAttr === 'true';

            ele.name = child.tagName;

            if (!ele.y && (ele.isFn || ele.isSub)) {
                 ele.y = lastY;
            } else if (!ele.y && child.tagName === 'text') {
                 // Try to fallback or skip? Go code logic relies on 'y' being present mostly
            }

            if (child.tagName === 'text') {
                if (child.textContent) {
                    ele.content = child.textContent;
                }
                
                // Handle nested <a> tags for footnotes?
                // Go code: if children.Name == "text" ... children.Children ... if child.Name == "a"
                const aTags = child.getElementsByTagName('a');
                if (aTags.length > 0) {
                    for (let i=0; i<aTags.length; i++) {
                        const aTag = aTags[i];
                        ele.content += aTag.textContent || "";
                        const href = aTag.getAttribute('href') || "";
                        if (href) {
                             const hrefParts = href.split('/');
                             const lastPart = hrefParts[hrefParts.length - 1];
                             const tagArr = lastPart.split('#');
                             if (tagArr.length > 1) {
                                 ele.fn.href = '#' + tagArr[0] + '_' + tagArr[1]; // Simplified logic
                                 ele.id = chapterId + '_' + tagArr[1];
                             } else {
                                 ele.fn.href = '#' + tagArr[0];
                                 ele.id = chapterId;
                             }
                             ele.fn.style = aTag.getAttribute('style') || "";
                        }
                    }
                }

                // Logic for superscripts/subscripts
                if (topAttr) {
                    const topInt = parseFloat(topAttr);
                    const heightInt = parseFloat(ele.height);
                    const lenInt = parseFloat(ele.len);
                    const lastTopInt = parseFloat(lastTop);
                    const lastHInt = parseFloat(lastH);

                    let isPossibleSuperOrSub = (heightInt < lastHInt * 0.8) && 
                        (child.tagName === lastName || (ele.content && ele.content.length <= 3 && this.isNumericOrMathSymbol(ele.content)));

                    let fontSizeIsSmaller = false;
                    if (ele.style.includes('font-size:11px') || ele.style.includes('font-size:12px') || ele.style.includes('font-size:13px')) {
                        fontSizeIsSmaller = true;
                    }

                    if (fontSizeIsSmaller) isPossibleSuperOrSub = true;

                    const yInt = parseFloat(ele.y);
                    const lastYInt = parseFloat(lastY);
                    
                    if (yInt && lastYInt && yInt < lastYInt && (lastYInt - yInt > 2)) {
                        isPossibleSuperOrSub = true;
                    }

                    if (isPossibleSuperOrSub) {
                        let isLikelyPower = (ele.content && ele.content.length <= 3 && this.isNumericOrMathSymbol(ele.content)); 
                        if (lenInt <= 5 && fontSizeIsSmaller) isLikelyPower = true;

                        if (isLikelyPower) {
                            if (topInt < lastTopInt) {
                                ele.isFn = true;
                                ele.newline = false;
                            } else {
                                ele.isSub = true;
                                ele.newline = false;
                            }
                        } else {
                            lastTop = topAttr;
                            lastH = ele.height;
                        }
                    } else {
                        lastTop = topAttr;
                        lastH = ele.height;
                    }
                }
                
                lastY = ele.y; // Update lastY for text
            } else if (child.tagName === 'image') {
                ele.href = child.getAttribute('xlink:href') || child.getAttribute('href') || "";
                ele.alt = child.getAttribute('alt') || "";
                
                const w = parseFloat(ele.width || '0');
                if (w > 0 && w < FOOT_NOTE_IMG_W && ele.class) { // Go also checks if class exists: len(item.Class) > 0
                    ele.isFootnoteImage = true;
                    // Go code also checks k > 0 and uses prevChild's Y for footnote image alignment
                    if (k > 0) {
                        const prevChild = children[k-1];
                        const prevY = prevChild.getAttribute('y');
                        if (prevY) ele.y = prevY;
                    }
                }
            }

            // Style processing
            ele.style = ele.style.replace(/fill/g, 'color');
            if (ele.style.includes('font-weight: bold;')) ele.isBold = true;
            if (ele.style.includes('font-style: oblique') || ele.style.includes('font-style: italic')) ele.isItalic = true;

            const yVal = parseFloat(ele.y);
            if (!isNaN(yVal)) {
                if (!lineContent.has(yVal)) {
                    lineContent.set(yVal, []);
                }
                lineContent.get(yVal)?.push(ele);
            }
            
            lastName = child.tagName;
        }

        return lineContent;
    }

    private generateHtmlFromLines(lineContent: Map<number, HtmlEle[]>, chapterId: string): ConvertedPage { // Added chapterId param
        let html = '<div class="page-content">';
        const images: string[] = [];
        const footnotes: { id: string, text: string }[] = []; // Collect footnotes here

        // Sort lines by Y coordinate
        const sortedYs = Array.from(lineContent.keys()).sort((a, b) => a - b);

        for (const y of sortedYs) {
            const lineItems = lineContent.get(y)!;
            
            let lineHtml = '';
            let lineText = ''; 
            
            const firstItem = lineItems[0];
            const firstX = parseFloat(firstItem.x);
            
            const centerL = (REQ_EBOOK_PAGE_WIDTH / 2) * 0.9;
            const centerH = (REQ_EBOOK_PAGE_WIDTH / 2) * 1.1;
            const rightL = (REQ_EBOOK_PAGE_WIDTH) * 0.9;

            let alignStyle = '';
            if (firstX >= centerL && firstX <= centerH) {
                alignStyle = 'text-align:center;';
            } else if (firstX >= rightL) {
                alignStyle = 'text-align:right;';
            }

            let currentSpanStyle = '';
            let hasUnclosedSpan = false;

            for (let i = 0; i < lineItems.length; i++) {
                const item = lineItems[i];
                
                if (item.name === 'image') {
                    if (item.href) {
                        images.push(item.href); // Keep original remote URL in images list
                        
                        const widthVal = parseFloat(item.width || '0');
                        const heightVal = parseFloat(item.height || '0');
                        
                        // Reference format: no decimals if integer, else 6 decimals?
                        // Reference output shows: width="10" (no decimals) for small icons.
                        // And usually width="10.000000" in generated output.
                        // We should format it.
                        const widthStr = Number.isInteger(widthVal) ? widthVal.toString() : widthVal.toFixed(6);
                        const heightStr = Number.isInteger(heightVal) ? heightVal.toString() : heightVal.toFixed(6);

                        let imgTagContent = `<img src="__IMG_PLACEHOLDER_${encodeURIComponent(item.href)}__" alt="${item.alt}"`;
                        if (item.width) imgTagContent += ` width="${widthStr}"`;
                        if (item.height) imgTagContent += ` height="${heightStr}"`; 
                        
                        // Check for footnote image (small size)
                        const isFootnoteIcon = widthVal > 0 && widthVal <= 20;

                        if (isFootnoteIcon) {
                             // Add specific classes found in reference
                             imgTagContent += ` class="epub-footnote zhangyue-footnote qqreader-footnote"`;
                        }
                        
                        imgTagContent += ' />';

                        if (isFootnoteIcon) { // Use size check for footnote logic in generation too
                            // Use simple sequential footnote IDs like Go does: footnote-3-<num>
                            const footnoteNum = this.getNextFootnoteNum ? this.getNextFootnoteNum() : this.footnoteCounter++;
                            const footnoteId = `footnote-3-${footnoteNum}`;
                            const footnoteText = this.escapeHtml(item.alt);
                            footnotes.push({ id: footnoteId, text: footnoteText });

                            // If there was an open span, close it temporarily? Or just append.
                            // Ideally footnote ref is superscript.
                            // Go reference: <sup><a ...><img .../></a></sup>
                            // The current logic does this below:
                            
                            // Close span if needed
                            let spanClosed = false;
                            if (hasUnclosedSpan) {
                                lineHtml += '</span>';
                                spanClosed = true;
                            }

                            lineHtml += `<sup><a class="duokan-footnote" epub:type="noteref" href="#${footnoteId}">${imgTagContent}</a></sup>`;
                            
                            // Reopen span if needed
                            if (spanClosed) {
                                lineHtml += `<span style="${currentSpanStyle}">`;
                            }
                        } else {
                            // Block/Large image
                            let spanClosed = false;
                            if (hasUnclosedSpan) {
                                lineHtml += '</span>';
                                spanClosed = true;
                            }
                            
                            // Go version wraps large images in div.image-wrapper
                            lineHtml += `<div class="image-wrapper" style="">${imgTagContent}</div>`;
                            
                            if (spanClosed) {
                                lineHtml += `<span style="${currentSpanStyle}">`;
                            }
                        }
                    }
                } else if (item.name === 'text') {
                    // Span management
                    if (hasUnclosedSpan && item.style !== currentSpanStyle) {
                        lineHtml += '</span>';
                        hasUnclosedSpan = false;
                    }
                    if (!hasUnclosedSpan && item.style) {
                        lineHtml += `<span style="${item.style}">`;
                        currentSpanStyle = item.style;
                        hasUnclosedSpan = true;
                    }

                    // Content decorators
                    let content = this.escapeHtml(item.content);
                    if (item.isBold) content = `<b>${content}</b>`;
                    if (item.isItalic) content = `<i>${content}</i>`;
                    
                    // Go code uses isFn for superscript, isSub for subscript.
                    // We need to map this carefully.
                    if (item.isFn) content = `<sup>${content}</sup>`; // Assuming isFn is for superscript generally
                    if (item.isSub) content = `<sub>${content}</sub>`; // Assuming isSub is for subscript

                    if (item.fn.href) {
                        content = `<a href="${item.fn.href}">${content}</a>`;
                    }

                    lineHtml += content;
                    lineText += item.content;
                }
            }

            if (hasUnclosedSpan) {
                lineHtml += '</span>';
            }
            
            if (lineHtml) {
                html += `<p style="${alignStyle}">${lineHtml}</p>\n`;
            }
        }

        html += '</div>';
        return { html, images, footnotes };
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
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Ported from Go's isNumericOrMathSymbol
    private isNumericOrMathSymbol(s: string): boolean {
        // Regex to check if string contains only digits or common math symbols
        // Go's unicode.IsDigit(r) and strings.ContainsRune("+-*/^()[]{}.,", r)
        const mathSymbols = "+-*/^()[]{}.,";
        for (const char of s) {
            if (!/\d/.test(char) && !mathSymbols.includes(char)) {
                return false;
            }
        }
        return true;
    }
}
