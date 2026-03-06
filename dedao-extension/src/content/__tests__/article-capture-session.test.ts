/**
 * @jest-environment jsdom
 */

import {
    addCanvasPadding,
    buildCapturePlan,
    buildCourseArticleFileName,
    resolveRuntimeCaptureSlice,
} from '../article-capture-session.ts';

describe('buildCapturePlan', () => {
    it('should split a long article into multiple capture steps', () => {
        const plan = buildCapturePlan({
            viewportHeight: 800,
            viewportWidth: 1440,
            scrollX: 0,
            startY: 200,
            endY: 2050,
            cropLeft: 100,
            cropTop: 150,
            cropWidth: 900,
            overlap: 80,
        });

        expect(plan.totalHeight).toBe(1850);
        expect(plan.steps.length).toBeGreaterThan(2);
        expect(plan.steps[0]).toEqual(expect.objectContaining({
            scrollToY: 200,
            outputOffsetY: 0,
        }));
        expect(plan.steps[1]).toEqual(expect.objectContaining({
            cropTop: 80,
            outputOffsetY: 650,
        }));
        expect(plan.steps[plan.steps.length - 1]).toEqual(expect.objectContaining({
            outputOffsetY: expect.any(Number),
            cropHeight: expect.any(Number),
        }));
    });

    it('should keep the final step inside article bounds', () => {
        const plan = buildCapturePlan({
            viewportHeight: 900,
            viewportWidth: 1440,
            scrollX: 0,
            startY: 100,
            endY: 1300,
            cropLeft: 120,
            cropTop: 120,
            cropWidth: 860,
            overlap: 100,
        });

        const last = plan.steps[plan.steps.length - 1];
        expect(last.scrollToY + last.cropTop + last.cropHeight).toBeLessThanOrEqual(1300);
    });

    it('should add white padding around the stitched image', () => {
        expect(addCanvasPadding({ width: 960, height: 1800 })).toEqual({
            width: 1008,
            height: 1864,
            paddingX: 24,
            paddingTop: 24,
            paddingBottom: 40,
        });
    });

    it('should build filename from course title and article title', () => {
        expect(buildCourseArticleFileName({
            courseTitle: '贾行家·年度人文课堂（年度日更）',
            title: '191｜ 读庄子·大宗师（2）：庄子VS斯多葛派VS老子',
            articleId: 'abc123',
        })).toBe('贾行家·年度人文课堂（年度日更）_191｜ 读庄子·大宗师（2）：庄子VS斯多葛派VS老子.png');
    });

    it('should adjust cropTop from actual scroll position at runtime', () => {
        const plan = buildCapturePlan({
            viewportHeight: 800,
            viewportWidth: 1440,
            scrollX: 0,
            startY: 200,
            endY: 2050,
            cropLeft: 100,
            cropTop: 150,
            cropWidth: 900,
            overlap: 80,
        });

        const second = plan.steps[1];
        const resolved = resolveRuntimeCaptureSlice(second, {
            actualScrollY: 845,
            viewportHeight: 800,
        });

        expect(second.scrollToY).toBe(770);
        expect(second.contentTopY).toBe(850);
        expect(resolved.cropTop).toBe(5);
        expect(resolved.cropHeight).toBe(second.cropHeight);
    });
});
