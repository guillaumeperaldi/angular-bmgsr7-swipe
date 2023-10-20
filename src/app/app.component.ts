import { Component } from '@angular/core';
import { DirectionNamesEnum, EmitObj, gestureOpts } from './gestures.directive';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.css'],
})
export class AppComponent {
  protected readonly gestureOpts = gestureOpts;

  swipeTab(e: EmitObj): void {
    let direction = 0;
    if (e && e.dirX) {
      if (e.dirX === DirectionNamesEnum.left) {
        direction = 1;
      } else if (e.dirX === DirectionNamesEnum.right) {
        direction = -1;
      }
    }
  }
}
