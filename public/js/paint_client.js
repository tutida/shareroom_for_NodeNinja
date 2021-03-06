//ペイントオブジェクトの処理
(function(){

  // ページロード時の処理
  $(document).ready(function () {
    var paint = new Paint('canvas-node');
    var src2 = null;

    socket.on('connected', function(data) {
      socket.emit('request points', minichat.roomId);
    });

    socket.on('request paintLog', function(data, callback) {
      var png = paint.canvas.toDataURL();
      callback({log:png,width:paint.canvas.width,height:paint.canvas.height});
    });

    socket.on('draw canvas', function(message){
      var d = JSON.parse(message);
      paint.drawCanvas(d);
    });

    socket.on('draw text', function(message){
      var d = JSON.parse(message);
      paint.drawText(d);
    });

    socket.on('add inter', function(message){
      $('#main-contents').addClass('intercepter')
    });

    socket.on('paste', function(src){
      var img = new Image();
      img.src = src;
      img.onload = function() {
        var SizeW = img.width;
        var SizeH = img.height;
        if(img.width > paint.canvas.width || img.height > paint.canvas.height){
          var scaleW = img.width/paint.canvas.width;
          var scaleH = img.height/paint.canvas.height;

          if(scaleW >= scaleH){
            SizeW = img.width/scaleW;
            SizeH = img.height/scaleW;
          }else{
            SizeW = img.width/scaleH;
            SizeH = img.height/scaleH;
          }
        }
        paint.context.drawImage(img, 0, 0,SizeW,SizeH);
          $('#main-contents').removeClass('intercepter');        
      }
    });

    socket.on('clear canvas', function(message){
      paint.clearCanvas();
    });

    socket.on('resize canvas', function (data){
      $("#canvas-node").attr({height:data.height});
      $("#canvas-node").attr({width:data.width});
      paint.clearCanvas();
    });


    $(function() {
      if(!window.FileReader) {
        alert("File API がサポートされていません。");
        return false;
      }
      var cancelEvent = function(event) {
          event.preventDefault();
          event.stopPropagation();
          return false;
      }
      $(paint.canvas).bind("dragenter", cancelEvent);
      $(paint.canvas).bind("dragover", cancelEvent);

      var handleDroppedFile = function(event) {
        socket.emit('dropStart', minichat.roomId);
        var file = event.originalEvent.dataTransfer.files[0];
        var fileReader = new FileReader();
        fileReader.onload = function(event) {
          var img = new Image();
          img.src = event.target.result;

          img.onload = function() {
            socket.emit('imagePaste', {src: img.src,roomId: minichat.roomId});
          }
        }
        fileReader.readAsDataURL(file);

        cancelEvent(event);
        return false;
      }
      $(paint.canvas).bind("drop", handleDroppedFile);
    });
  });

  var Paint = function(id) {
   this.id = id;
   this.canvas = document.getElementById(id);
   this.context = this.canvas.getContext('2d');

   this.init();
   this.setEvents();
  };

  Paint.prototype.init = function() {
   this.beforeX = null;
   this.beforeY = null;
   this.isDrawing = false;

   this.strokeAction = 'pencil';
   this.strokeColor = '#000';
   this.lineWidth = 10;
  };

  Paint.prototype.setEvents = function() {
   var self = this;

   $(this.canvas).on('mousedown touchstart', function(e){
   	e.preventDefault();

    self.lineWidth = $('#amount').val();
    self.strokeColor = $('#swatch').css('background-color');    
    if(!input_text) {
      self.strokeAction = $("input[name='styleRadio']:checked").val();
      self.down(e);
    }
   });

   $(this.canvas).on('mouseup mouseout touchend touchcancel', function(e){
   	 e.preventDefault();
     if (self.isDrawing) {
       if(!input_text)  self.up(e);
     }else if(input_text){
		self.sendText(e);
     }
   });

   $(this.canvas).on('mousemove touchmove', function(e){
   	 e.preventDefault();
     if (self.isDrawing) {
       if(!input_text)  self.move(e);
     }
   });
  };

  Paint.prototype.down = function(event) {
   this.isDrawing = true;
   var x;
   var y;
   x = event.pageX || event.originalEvent.changedTouches[0].pageX;
   y = event.pageY || event.originalEvent.changedTouches[0].pageY;
   x -= this.canvas.offsetLeft;
   y -= this.canvas.offsetTop;
   this.beforeX = x - 10;
   this.beforeY = y - 10;
  };

  Paint.prototype.up = function(event) {
   this.isDrawing = false;
  };

  Paint.prototype.move = function(event) {
   if (!this.isDrawing) {
     return;
   }

   var x;
   var y;
   x = event.pageX || event.originalEvent.changedTouches[0].pageX;
   y = event.pageY || event.originalEvent.changedTouches[0].pageY;
   x -= this.canvas.offsetLeft;
   y -= this.canvas.offsetTop;

   var points = {
     bx: this.beforeX,
     by: this.beforeY,
     ax: x- 10,
     ay: y - 10,
     action: this.strokeAction,
     color: this.strokeColor,
     width: this.lineWidth
   };

   if (socket) {
     socket.emit("sendPoints",{message: JSON.stringify(points),roomId: minichat.roomId});
   } else {
     this.drawLine(points);
   }

   this.beforeX = points.ax;
   this.beforeY = points.ay;
  };

  Paint.prototype.drawCanvas = function(points) {
   this.context.beginPath();
   this.context.strokeStyle = points.color;
   this.context.lineWidth = points.width;

   switch(points.action){
    case 'pencil':
      this.context.lineCap = 'round';
      this.context.lineJoin = 'round';
      break;
    case 'brush':
      this.context.lineCap = 'butt';
      this.context.lineJoin = 'miter';
      break;
   }

   this.context.moveTo(points.bx, points.by);
   this.context.lineTo(points.ax, points.ay);
   this.context.stroke();
   this.context.closePath();
  };

  Paint.prototype.clearCanvas = function(socket) {
   this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  };

  Paint.prototype.clear = function(socket) {
     this.clearCanvas();
  };

  Paint.prototype.sendText = function (event) {

    var x;
    var y;
    x = event.pageX || event.originalEvent.changedTouches[0].pageX;
    y = event.pageY || event.originalEvent.changedTouches[0].pageY;
    x -= this.canvas.offsetLeft;
    y -= this.canvas.offsetTop;

    if(x <= 0 || y <= 0 || x > this.canvas.width || y > this.canvas.height){
    	return;
    }

    var pos = {x:x, y:y};

    var text, size, color;
 
    text = $('#text').val();
    size = this.lineWidth;
    color = this.strokeColor;
 
    text = (text === '') ? 'Example' : text;
    color = (color === '') ? '#000' : color;
    size = (size === '') ? '14px' : parseInt(size, 10) + 'px';

    var profs = {
      text: text,
      size: size,
      color: color,
      x:x,
      y:y
    };
    socket.emit("sendText",{message: JSON.stringify(profs),roomId: minichat.roomId});
  }

  Paint.prototype.drawText = function (data) {
    var text, size, color, x, y;
    text = data.text;
    size = data.size;
    color = data.color;
    x = data.x;
    y = data.y;

    this.context.font = size + ' "sans-serif"';
    this.context.fillStyle = color;
    this.context.fillText(text, x, y);
  }

  window.Paint = Paint;

}).apply(this);