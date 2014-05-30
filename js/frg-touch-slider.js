var FroggerTouchSlider = (function($, Hammer){

  // Debug mode
  var _DEBUG = false;

  // DOM elements
  var _container,   // jQuery element - what masks the sliding content
      _content,     // jQuery element - what slides
      _cards;       // Object - card properties

  // touch events
  var _BOUNCE_DISTANCE = 20; // default, but update via margin
  var _hammer,      // Hammer - touch events library
      _dragStartX,
      _snapPoints,  // Array
      _snapPointIndex = 0;

  function _init(containerSelector) {
    
    // save reference to DOM elements as jQuery objects
    _container = $(containerSelector);
    _content = _container.find('div:first-child');

    // dynamically grab the # of cards and their dimensions (based on the first card)
    _cards = _content.find('.card');
    _cards.numCards = _cards.length;

    var firstCard = _cards.first();
    _cards.height = firstCard.outerHeight();
    _cards.width = firstCard.outerWidth();
    _cards.margin = parseInt(firstCard.css('margin-right'), 10);

    // update bounce distance and snap points
    _snapPoints = _generateSnapPoints();
    _limits = _generateLimits();

    $(window).resize(function() {
      if ( _DEBUG ) {
        _clearDebugLines();
      }
      // TODO: apply if touch only?
      _limits = _generateLimits();
      var x = _getCurrentPosition();
      var snapPoint = _getClosestSnapPoint(x); //to update _snapPointIndex
      // if ( x < _limits.maxRight ) {
      // if ( snapPoint < _limits.maxRight ) {
      //   _snapToPoint( _limits.maxRight );
      // }
      // else{
        _snapToPoint( snapPoint );
      // }  

    });

    // if touch:
    _initTouchEvents();

    // if keyboard:
    // TODO: _initKeyboardEvents();

    // if mouse:
    // TODO: _initMouseEvents();

  }

  function _initTouchEvents() {

    // init hammer.js touch events
    _hammer = new Hammer(_container.get(0), {
      drag: true,
      dragBlockHorizontal: true,
      dragLockToAxis: true,
      dragMinDistance: 10, //0
      transform: false,
      tap: false,
      hold: false,
      release: false,
      preventDefault: true,
      preventMouse: true
    });

    _hammer.on('dragstart', function(ev) {

      // remove CSS transition because it messes up with drag responsiveness
      _content.removeClass('animate');

      // save start x position so it can be compared in 'dragend'      
      _dragStartX = _getCurrentPosition();

    });

    _hammer.on('dragleft dragright', function(ev) {
      // simple dragging
      var x = _dragStartX + ev.gesture.deltaX; 
      
      // constrain dragging to be within limits:
      x = Math.min( _limits.left, Math.max( _limits.right, x ) );

      // update position (w/o CSS animation)
      _content.css({ left: x });
    });

    _hammer.on('dragend', function(ev){

      var SWIPE_VELOCITY = 0.1;

      var x = _getCurrentPosition(),
          snapPoint = x,
          draggedLeft = ( event.gesture.direction === 'left' ),
          draggedQuicky = ( event.gesture.velocityX >= SWIPE_VELOCITY );
      
      if ( _limits.isAtStart(x) || _snapPoints.length === 1 ) {
        // reached the left-most limit so snap to start
        snapPoint = _limits.start;
        _snapPointIndex = 0;
      }
      else if ( _limits.isAtEnd(x) ) {
        // reached the right-most limit so snap to end
        snapPoint = _limits.end;
        _snapPointIndex = _snapPoints.length - 1;
      }
      else if ( draggedQuicky ) {
        // it's like a 'swipe' so no need to have extra swipeleft, swiperight event
        if ( draggedLeft ) {
          if ( _snapPoints[_snapPointIndex+1] <= _limits.maxRight ) {
            snapPoint = _limits.maxRight;
          }
          else {
            _snapPointIndex += 1;
            snapPoint = _snapPoints[_snapPointIndex];
          }
        } 
        else {
          _snapPointIndex -= 1;
          snapPoint = _snapPoints[_snapPointIndex];
        }

      }
      else {
        // dragged to some midway point so figure out where to snap
        // TODO: It actually makes more sense to use drag direction (dragLeft)
        // and decide if they have dragged far enough along to merit snapping to the next card
        snapPoint = _getClosestSnapPoint(x);
      }

      _snapToPoint( snapPoint );

    });

  }

  function _snapToPoint( snapPoint ){
    // update position with CSS animation
    _content.addClass('animate');
    _content.css({ left: snapPoint });
  }

  function _getClosestSnapPoint(x) {

    // use first card as base for comparison:
    var i = 0,
        smallestDistance = Math.abs( x - _snapPoints[i] );

    // figure out which card it's closest too
    for ( i=1; i<_snapPoints.length; i++ ) {

      var distance = Math.abs( x - _snapPoints[i] );

      if ( distance > smallestDistance ) {
        // numbers are getting higher so it was the last card
        snapPoint = _snapPoints[i-1];
        _snapPointIndex = i-1;
        break; 
      }
      
      var distanceToEnd = Math.abs( x - _limits.end );
      // var distanceToEnd = Math.abs( x - _limits.maxRight ); //TODO: update to be more like this?
      if ( distance > distanceToEnd ) {
        // numbers are going past the right-most limit so snap to end instead of card
        snapPoint = _limits.end;
        _snapPointIndex = _snapPoints.length - 1;
        break; 
      }
      
      // update comparison base to be current card
      smallestDistance = distance;
      snapPoint = _snapPoints[i];
      _snapPointIndex = i;

    }

    return snapPoint;

  }

  function _snapToClosestPoint(i) {
    var snapPoint = _snapPoints[i];
    // update position with CSS animation
    _content.css({ left: snapPoint });
  }

  function _bounce(bounceX, finalX) {
    // update position with CSS animation
    _content.addClass('animate');
    _content.css({ left: bounceX });
    window.setTimeout( function(){
      _content.css({ left: finalX });
    }, 200 );
  }

  function _getCurrentPosition() {
    return parseInt(_content.css('left'), 10);
  }

  function _getWidth( element ) {
    return element.outerWidth();
  }

  function _generateLimits() {
    
    var contentWidth = _getWidth( _content ),
        containerWidth = _getWidth( _container ),
        difference = containerWidth - contentWidth, 
        end = Math.min( containerWidth, difference ),
        start = 0,
        left = start + _BOUNCE_DISTANCE,
        right,
        maxRight;

    if ( containerWidth > contentWidth) {
      right = -_BOUNCE_DISTANCE;
    }
    else {
      right = end - _BOUNCE_DISTANCE;
    }

    maxRight = contentWidth - containerWidth;

    if ( _DEBUG ) {
      _drawDebugLine( maxRight );
    }

    return {
      start: start,
      end: end, 
      left: left,
      right: right,
      maxRight: -maxRight,
      isAtStart: function(x) {
        return (x > start && x <= left);
      },
      isAtEnd: function(x) {
        return (x < end && x >= right);
      }
    };

  }

  function _generateSnapPoints() {

    var points = [];

    $(_cards).each(function(i){
      var x = -$(this).position().left;
      points.push(x);
    });

    return points;
  }

  function _drawDebugLine(x,color) {
    if ( color === undefined ) {
      color = 'red';
    }
    // console.log( "drawLine", x, color);
    var css = '' +
      'position: absolute; ' + 
      'top: 0; ' + 
      'left: ' + x + 'px; ' + 
      'width: 1px; ' + 
      'height: ' + _cards.height + 'px; ' + 
      'background-color: ' + color + ';';
    var line = '<div class="debug-line" style="'+css+'">&nbsp;</div>';
    _content.append(line);
  }

  function _clearDebugLines() {
    $('.debug-line').remove();
  }

  return {
    init: _init
  }

}(jQuery, Hammer));