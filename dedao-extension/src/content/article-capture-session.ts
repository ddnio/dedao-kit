import type { CourseArticlePageContext } from './book-context.ts';

const OVERLAP_PX = 80;
const STABILIZE_MS = 250;
const CANVAS_PADDING_X = 24;
const CANVAS_PADDING_TOP = 24;
const CANVAS_PADDING_BOTTOM = 40;

export interface CapturePlanInput {
    viewportHeight: number;
    viewportWidth: number;
    scrollX: number;
    startY: number;
    endY: number;
    cropLeft: number;
    cropTop: number;
    cropWidth: number;
    overlap?: number;
}

export interface CaptureStep {
    contentTopY: number;
    scrollToY: number;
    cropLeft: number;
    cropTop: number;
    cropWidth: number;
    cropHeight: number;
    outputOffsetY: number;
}

export interface CapturePlan {
    totalHeight: number;
    steps: CaptureStep[];
}

export function addCanvasPadding(size: { width: number; height: number }): {
    width: number;
    height: number;
    paddingX: number;
    paddingTop: number;
    paddingBottom: number;
} {
    return {
        width: size.width + CANVAS_PADDING_X * 2,
        height: size.height + CANVAS_PADDING_TOP + CANVAS_PADDING_BOTTOM,
        paddingX: CANVAS_PADDING_X,
        paddingTop: CANVAS_PADDING_TOP,
        paddingBottom: CANVAS_PADDING_BOTTOM,
    };
}

export function buildCapturePlan(input: CapturePlanInput): CapturePlan {
    const overlap = input.overlap ?? OVERLAP_PX;
    const totalHeight = Math.max(0, input.endY - input.startY);
    const steps: CaptureStep[] = [];
    const firstCropHeight = Math.min(totalHeight, input.viewportHeight - input.cropTop);
    if (firstCropHeight <= 0) {
        return { totalHeight, steps };
    }

    steps.push({
        contentTopY: input.startY,
        scrollToY: input.startY,
        cropLeft: input.cropLeft,
        cropTop: input.cropTop,
        cropWidth: input.cropWidth,
        cropHeight: firstCropHeight,
        outputOffsetY: 0,
    });

    let writtenHeight = firstCropHeight;
    let currentTop = input.startY + firstCropHeight;

    while (currentTop < input.endY) {
        const scrollToY = Math.max(input.startY, currentTop - overlap);
        const cropTop = currentTop - scrollToY;
        const remaining = input.endY - currentTop;
        const cropHeight = Math.min(remaining, input.viewportHeight - cropTop);
        steps.push({
            contentTopY: currentTop,
            scrollToY,
            cropLeft: input.cropLeft,
            cropTop,
            cropWidth: input.cropWidth,
            cropHeight,
            outputOffsetY: writtenHeight,
        });
        writtenHeight += cropHeight;
        currentTop += cropHeight;
    }

    return { totalHeight, steps };
}

export function resolveRuntimeCaptureSlice(
    step: CaptureStep,
    input: { actualScrollY: number; viewportHeight: number },
): Pick<CaptureStep, 'cropTop' | 'cropHeight'> {
    const cropTop = Math.max(0, Math.round(step.contentTopY - input.actualScrollY));
    const cropHeight = Math.max(0, Math.min(step.cropHeight, input.viewportHeight - cropTop));
    return { cropTop, cropHeight };
}

function sanitizeFileName(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'dedao_course_article';
}

export function buildCourseArticleFileName(ctx: Pick<CourseArticlePageContext, 'courseTitle' | 'title' | 'articleId'>): string {
    const left = sanitizeFileName(ctx.courseTitle);
    const right = sanitizeFileName(ctx.title);

    if (left && right && left !== 'dedao_course_article' && right !== 'dedao_course_article') {
        return `${left}_${right}.png`;
    }
    if (right && right !== 'dedao_course_article') {
        return `${right}.png`;
    }
    return `dedao_course_article_${ctx.articleId}.png`;
}

async function waitForStability(): Promise<void> {
    await new Promise((resolve) => window.setTimeout(resolve, STABILIZE_MS));
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    return image;
}

function getAbsoluteTop(el: HTMLElement): number {
    const rect = el.getBoundingClientRect();
    return rect.top + window.scrollY;
}

function buildPlanFromContext(ctx: CourseArticlePageContext): CapturePlan {
    const rootRect = ctx.captureRoot.getBoundingClientRect();
    const startY = getAbsoluteTop(ctx.captureStart);
    const endY = Math.max(startY, getAbsoluteTop(ctx.captureEnd) + ctx.captureEnd.getBoundingClientRect().height);

    return buildCapturePlan({
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        scrollX: window.scrollX,
        startY,
        endY,
        cropLeft: Math.max(0, rootRect.left),
        cropTop: Math.max(0, ctx.captureStart.getBoundingClientRect().top),
        cropWidth: Math.min(rootRect.width, window.innerWidth - Math.max(0, rootRect.left)),
        overlap: OVERLAP_PX,
    });
}

async function captureVisibleTab(): Promise<string> {
    const response = await chrome.runtime.sendMessage({ action: 'CAPTURE_VISIBLE_TAB' }) as { dataUrl?: string; error?: string };
    if (!response?.dataUrl) {
        throw new Error(response?.error || '截图失败');
    }
    return response.dataUrl;
}

function hideTopFixedOverlays(cropLeft: number, cropWidth: number): Array<() => void> {
    const restoreFns: Array<() => void> = [];
    const cropRight = cropLeft + cropWidth;
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('body *'));

    candidates.forEach((el) => {
        const style = window.getComputedStyle(el);
        if (style.position !== 'fixed' && style.position !== 'sticky') return;
        if (el.classList.contains('dd-course-shot-root')) return;

        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        if (rect.bottom <= 0 || rect.top >= Math.min(window.innerHeight, 180)) return;

        const overlapsHorizontally = rect.right > cropLeft && rect.left < cropRight;
        if (!overlapsHorizontally) return;

        const prevVisibility = el.style.visibility;
        el.style.visibility = 'hidden';
        restoreFns.push(() => {
            el.style.visibility = prevVisibility;
        });
    });

    return restoreFns;
}

export async function captureCourseArticleImage(
    ctx: CourseArticlePageContext,
    onProgress: (progress: { phase: 'capturing' | 'stitching'; percent: number }) => void,
): Promise<{ blob: Blob; filename: string }> {
    const originalX = window.scrollX;
    const originalY = window.scrollY;
    const plan = buildPlanFromContext(ctx);
    const slices: Array<{ image: HTMLImageElement; step: CaptureStep }> = [];
    const restoreOverlays = hideTopFixedOverlays(plan.steps[0]?.cropLeft ?? 0, plan.steps[0]?.cropWidth ?? window.innerWidth);

    try {
        for (let index = 0; index < plan.steps.length; index += 1) {
            const step = plan.steps[index];
            window.scrollTo({ top: step.scrollToY, left: originalX, behavior: 'auto' });
            await waitForStability();
            const runtimeSlice = resolveRuntimeCaptureSlice(step, {
                actualScrollY: window.scrollY,
                viewportHeight: window.innerHeight,
            });
            const dataUrl = await captureVisibleTab();
            const image = await loadImage(dataUrl);
            slices.push({
                image,
                step: {
                    ...step,
                    cropTop: runtimeSlice.cropTop,
                    cropHeight: runtimeSlice.cropHeight,
                },
            });
            onProgress({
                phase: 'capturing',
                percent: ((index + 1) / plan.steps.length) * 100,
            });
        }

        onProgress({ phase: 'stitching', percent: 100 });

        const firstImage = slices[0]?.image;
        if (!firstImage) {
            throw new Error('未捕获到图片');
        }

        const scale = firstImage.width / window.innerWidth;
        const contentWidth = Math.round(plan.steps[0].cropWidth * scale);
        const contentHeight = Math.round(plan.totalHeight * scale);
        const padding = addCanvasPadding({ width: contentWidth, height: contentHeight });
        const canvas = document.createElement('canvas');
        canvas.width = padding.width;
        canvas.height = padding.height;

        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('无法创建画布');
        }

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        slices.forEach(({ image, step }) => {
            context.drawImage(
                image,
                Math.round(step.cropLeft * scale),
                Math.round(step.cropTop * scale),
                Math.round(step.cropWidth * scale),
                Math.round(step.cropHeight * scale),
                padding.paddingX,
                padding.paddingTop + Math.round(step.outputOffsetY * scale),
                Math.round(step.cropWidth * scale),
                Math.round(step.cropHeight * scale),
            );
        });

        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((value) => {
                if (value) {
                    resolve(value);
                    return;
                }
                reject(new Error('图片生成失败'));
            }, 'image/png');
        });

        return {
            blob,
            filename: buildCourseArticleFileName(ctx),
        };
    } finally {
        restoreOverlays.forEach((restore) => restore());
        window.scrollTo({ top: originalY, left: originalX, behavior: 'auto' });
    }
}
