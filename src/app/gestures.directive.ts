// https://jordanbenge.medium.com/ionic-4-gestures-made-easy-5ce30aa82b7b
import { Directive, ElementRef, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { GestureController, GestureDetail } from '@ionic/angular';

export type GestureNames = 'tap' | 'doubleTap' | 'press' | 'swipe';

export type DirectionNames =
    | DirectionNamesEnum.up
    | DirectionNamesEnum.down
    | DirectionNamesEnum.left
    | DirectionNamesEnum.right;
export enum DirectionNamesEnum {
    'up' = 'up',
    'down' = 'down',
    'left' = 'left',
    'right' = 'right',
}

export type ReportInterval = 'start' | 'live' | 'end';
export enum ReportIntervalEnum {
    'start' = 'start',
    'live' = 'live',
    'end' = 'end'
};

export type VerticalSwipe = DirectionNames | undefined;
export type HorizontalSwipe = DirectionNames | undefined;
export type EmitObj = {
    dirX: HorizontalSwipe;
    dirY: VerticalSwipe;
    swipeType: string;
} & GestureDetail;

export interface Gesture {
    name: GestureNames; // The gestureName that you want to use. Defined above.
    interval?: number; // Maximum time in ms between multiple taps
    enabled?: boolean; // Whether the gesture is enabled or not.
    direction?: DirectionNames[]; // Direction - used to Swipe
    threshold?: number;
    reportInterval?: ReportInterval;
}
export const gestureOpts: Gesture[] = [{ name: 'tap' }, { name: 'doubleTap' }, { name: 'press' }, { name: 'swipe' }];
@Directive({
    standalone: true,
    selector: '[app-gestures]',
})
export class GestureDirective implements OnInit {
    @Input() gestureOpts!: Gesture[]; // Events we can listen to.
    @Output() tap: EventEmitter<EmitObj> = new EventEmitter();
    @Output() doubleTap: EventEmitter<EmitObj> = new EventEmitter();
    @Output() press: EventEmitter<string> = new EventEmitter();
    @Output() swipe: EventEmitter<EmitObj> = new EventEmitter();

    tapGesture: Gesture = {
        name: 'tap',
        enabled: false,
        interval: 250,
    };
    doubleTapGesture: Gesture = {
        name: 'doubleTap',
        enabled: false,
        interval: 300,
    };
    pressGesture: Gesture = {
        name: 'press',
        enabled: false,
        interval: 251,
    };
    swipeGesture: Gesture = {
        name: 'swipe',
        enabled: false,
        interval: 250,
        threshold: 15, // the minimum distance before reporting a swipe.
        reportInterval: undefined,
        direction: [],
    };
    directiveGestures = [this.tapGesture, this.doubleTapGesture, this.pressGesture, this.swipeGesture];
    gestureCreated = false;
    lastTap = 0;
    tapCount = 0;
    tapTimeout: number | undefined = undefined;
    pressTimeout: number | undefined = undefined;
    isPressing: boolean = false;
    moveTimeout: number | undefined = undefined;
    isMoving: boolean = false;
    lastSwipeReport: number | null = null;

    constructor(private gestureCtrl: GestureController, private el: ElementRef) {}

    ngOnInit() {
        // This will set up the gestures that the user has provided in their Gesture Options.
        this.directiveGestures.filter((dGesture) => this.gestureOpts.find(({ name }) => dGesture.name === name)).map(
            (gesture) => {
                gesture.enabled = true;
                if (gesture.name === 'swipe') {
                    const swipeGestureOpts = this.gestureOpts.find(({ name }) => name == 'swipe');
                    this.swipeGesture.direction = swipeGestureOpts?.direction || [
                        DirectionNamesEnum.left,
                        DirectionNamesEnum.right,
                    ];
                    this.createGesture();
                }
            }
        );
        if (this.pressGesture.enabled && this.swipeGesture.enabled) {
            console.warn('Press and Swipe should not be enabled on the same element.');
        }
        if (this.gestureOpts.length === 0) {
            console.warn('No gestures were provided in Gestures array');
        }
    }

    @HostListener('touchstart', ['$event'])
    @HostListener('touchend', ['$event'])
    onPress(e: Event) {
        if (!this.pressGesture.enabled) {
            return;
        } // Press is not enabled, don't do anything.
        this.handlePressing(e.type);
    }

    @HostListener('click', ['$event'])
    handleTaps(e: Event) {
        const tapTimestamp = Math.floor(e.timeStamp);
        const isDoubleTap = this.lastTap + (this.tapGesture.interval ? this.tapGesture.interval : 0) > tapTimestamp;
        if ((!this.tapGesture.enabled && !this.doubleTapGesture.enabled) || this.isPressing || this.isMoving) {
            return this.resetTaps();
        }
        this.tapCount++;
        if (isDoubleTap && this.doubleTapGesture.enabled) {
            this.emitTaps();
        } else if (!isDoubleTap) {
            this.tapTimeout = window.setTimeout(() => this.emitTaps(), this.tapGesture.interval);
        }
        this.lastTap = tapTimestamp;
    }

    private handleMoving(moveType: string, $event: GestureDetail) {
        if (this.moveTimeout) {
            window.clearTimeout(this.moveTimeout);
            this.moveTimeout = undefined;
        }
        const deltaX = $event.deltaX;
        const deltaY = $event.deltaY;
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);
        const reportInterval = this.swipeGesture.reportInterval || 'live';
        const threshold = this.swipeGesture.threshold;

        if (!threshold || (absDeltaX < threshold && absDeltaY < threshold)) {
            // We haven't moved enough to consider it a swipe.
            return;
        }
        const shouldReport =
            this.isMoving &&
            ((reportInterval === ReportIntervalEnum.start && this.lastSwipeReport === null) ||
                reportInterval === ReportIntervalEnum.live ||
                (reportInterval === ReportIntervalEnum.end && moveType == 'moveend'));
        this.lastSwipeReport = $event.startTime;
        if (shouldReport) {
            let emit = {
                dirX: undefined,
                dirY: undefined,
                swipeType: moveType,
                ...$event,
            } as EmitObj;
            if (absDeltaX > threshold) {
                if (deltaX > 0) {
                    emit.dirX = DirectionNamesEnum.right;
                } else if (deltaX < 0) {
                    emit.dirX = DirectionNamesEnum.left;
                }
            }
            if (absDeltaY > threshold) {
                if (deltaY > 0) {
                    emit.dirY = DirectionNamesEnum.down;
                } else if (deltaY < 0) {
                    emit.dirY = DirectionNamesEnum.up;
                }
            }
            const dirArray = this.swipeGesture.direction;
            if (dirArray?.includes(emit.dirX as DirectionNames) || dirArray?.includes(emit.dirY as DirectionNames)) {
                this.swipe.emit(emit);
            }
        }
        if (moveType == 'moveend' && this.lastSwipeReport !== null) {
            this.isMoving = false;
            this.lastSwipeReport = null;
        }
    }

    private handlePressing(type: string) {
        // touchend or touchstart
        if (type == 'touchstart') {
            this.pressTimeout = window.setTimeout(() => {
                this.isPressing = true;
                this.press.emit(ReportIntervalEnum.start);
            }, this.pressGesture.interval); // Considered a press if it's longer than interval (default: 251).
        } else if (type == 'touchend') {
            window.clearTimeout(this.pressTimeout);
            if (this.isPressing) {
                this.press.emit(ReportIntervalEnum.end);
                this.resetTaps(); // Just in case this gets passed as a tap event too.
            }
            // Clicks have a natural delay of 300ms, so we have to account for that, before resetting isPressing.
            // Otherwise, a tap event is emitted.
            window.setTimeout(() => (this.isPressing = false), 50);
        }
    }

    private createGesture() {
        if (this.gestureCreated) {
            return;
        }
        const gesture = this.gestureCtrl.create(
            {
                gestureName: 'gesture',
                el: this.el.nativeElement,
                onStart: () => {
                    if (this.swipeGesture.enabled) {
                        this.isMoving = true;
                        this.moveTimeout = window.setInterval(() => {
                            this.isMoving = false;
                        }, 249);
                    }
                },
                onMove: ($event) => {
                    if (this.swipeGesture.enabled) {
                        this.handleMoving('moving', $event);
                    }
                },
                onEnd: ($event) => {
                    if (this.swipeGesture.enabled) {
                        this.handleMoving('moveend', $event);
                    }
                },
            },
            true
        );
        gesture.enable();
        this.gestureCreated = true;
    }

    private emitTaps() {
        if (this.tapCount === 1 && this.tapGesture.enabled) {
            this.tap.emit();
        } else if (this.tapCount === 2 && this.doubleTapGesture.enabled) {
            this.doubleTap.emit();
        }
        this.resetTaps();
    }

    private resetTaps() {
        window.clearTimeout(this.tapTimeout); // clear the old timeout
        this.tapCount = 0;
        this.tapTimeout = undefined;
        this.lastTap = 0;
    }
}
