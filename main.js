/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var spriteShader = null;
var proj = [];
var spriteVBuff = null;

var ballBuffer = null;
var ballIdxBuffer = null;
var ballIdxCount = null;

var backgroundImages = [];
var longTexture = null;
var solidBlockTexture = null;
var blockTexture = null;
var paddleTexture = null;
var ballTexture = null;
var menuTexture = null;
var overTexture = null;

var levels = null;
var currentLevel = null;

var player = null;
var leftPressed = false;
var rightPressed = false;

var ball = null;
var scoreboard = null;
var score = 0;

var prevTime = Date.now();

const Power = {
  LONG : "Long",
  FAST : "Fast"
};
var powers = [];

const GameState = {
  MENU : "Menu",
  ACTIVE : "Active",
  OVER : "Over"
};

var state = GameState.MENU;

function spawnPowers(brick) {
  if(Math.random() < .3)
    powers.push({
      pos : vec2.fromValues(brick.pos[0], brick.pos[1]),
      size : vec2.fromValues(60, 20),
      rot : 0,
      texture : longTexture,
      color : vec3.fromValues(1, 1, 1),
      velocity : vec2.fromValues(0, .15), 
      solid : false,
      destroyed : false,
      activated : false,
      type : Power.LONG, 
      duration : 0,
      draw : function() {
        drawSprite(this.texture, this.pos, this.size, this.rot, this.color, false);
      }
    });
  if(Math.random() < .3)
    powers.push({
      pos : vec2.fromValues(brick.pos[0], brick.pos[1]),
      size : vec2.fromValues(60, 20),
      rot : 0,
      texture : longTexture,
      color : vec3.fromValues(1, 0, 0),
      velocity : vec2.fromValues(0, .2), 
      solid : false,
      destroyed : false,
      activated : false,
      type : Power.FAST, 
      duration : 9000,
      draw : function() {
        drawSprite(this.texture, this.pos, this.size, this.rot, this.color, false);
      }
    });
}

function activatePower(power) {
  switch(power.type) {
    case Power.LONG:
      player.size[0] += 50;
      break;
    case Power.FAST:
      player.velocity += 1;
      player.color[0] += .5;
      break;
  }
}

function otherPowerActive(type) {
  powers.forEach(p => {
    if(p.activated && p.type === type)
      return true;
  })
  return false;
}

function render() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
  
  var now = Date.now();
  var dt = now - prevTime;
  prevTime = now;

  handleInput(dt);
  ball.move(dt, canvas.width);
  // collision handling from learnopengl.com
  // https://learnopengl.com/In-Practice/2D-Game/Collisions/Collision-resolution
  levels[currentLevel].bricks.forEach((b) => {
    if (!b.destroyed)
    {
      let col = checkCollision(ball, b);
      if (col.collided)
      {
        if(!b.solid) {
          score += 1;
          b.destroyed = true;
          spawnPowers(b);
        }

        if(col.dir === Direction.LEFT || col.dir === Direction.RIGHT) {
          ball.velocity[0] *= -1;
          let pen = ball.radius - Math.abs(col.diff[0]);
          if(col.dir === Direction.LEFT)
            ball.pos[0] += pen;
          else
            ball.pos[0] -= pen;
        }
        else {
          ball.velocity[1] *= -1;
          let pen = ball.radius - Math.abs(col.diff[1]);
          if(col.dir === Direction.UP) 
            ball.pos[1] -= pen;
          else
            ball.pos[1] += pen;
        }
      }
    }
  });
  powers.forEach(p => {
    if(!p.destroyed) {
      if(p.pos[1] >= canvas.height)
        p.destroyed = true;
      if(aabbCollision(player, p)) {
        activatePower(p);
        score += 5;
        p.destroyed = true;
        p.activated = true;
      }
    }
  });
  let col = checkCollision(ball, player);
  if(!ball.stuck && col.collided) {
    let center = player.pos[0] + player.size[0] / 2;
    let dist = (ball.pos[0] + ball.radius) - center;
    let perc = dist / (player.size[0] / 2);
    let oldVelMag = vec2.length(ball.velocity);
    ball.velocity[0] = 2 * .1 * perc;
    vec2.normalize(ball.velocity, ball.velocity);
    ball.velocity[0] *= oldVelMag;
    ball.velocity[1] *= oldVelMag;
    ball.velocity[1] = -1 * Math.abs(ball.velocity[1]);
    let randX = Math.random();
    let randY = Math.random();
    ball.velocity[0] += randX / 2; 
    ball.velocity[1] += randY / 2;
  }
  powers.forEach(p => {
    vec2.add(p.pos, p.pos, vec2.fromValues(p.velocity[0] * dt, p.velocity[1] * dt));
    if(p.activated) {
      p.duration -= dt;
      if(p.duration <= 0) {
        p.activated = false;
        switch(p.type) {
          case Power.FAST:
            player.velocity -= 1;
            player.color[0] -= .5;
            break;
        }
      }
    }
  });
  powers = powers.filter(p => !(p.destroyed && !p.activated));

  if (ball.pos[1] >= canvas.height)
  {
    levels[currentLevel].reset();
    player.pos = vec2.fromValues(canvas.width / 2 - 100 / 2, canvas.height - 20);
    player.size = vec2.fromValues(100, 20);
    player.velocity = .5;
    player.color = vec3.fromValues(1, 1, 1);
    ball.pos = vec2.add([], player.pos, vec2.fromValues(player.size[0] / 2 - 12.5, -12.5 * 2));
    ball.velocity = vec2.fromValues(.1, -.35);
    ball.stuck = true;
    powers.length = 0;
    score -= 10;
  }
  let allDestroyed = true;
  levels[currentLevel].bricks.forEach((b) => {
    if(!b.solid && b.destroyed == false) {
      allDestroyed = false;
      return;
    }
  });
  if(allDestroyed) {
    currentLevel++;
    if(currentLevel >= levels.length) {
      state = GameState.OVER;
      currentLevel = 0;
    }
    levels[currentLevel].reset();
    player.pos = vec2.fromValues(canvas.width / 2 - 100 / 2, canvas.height - 20);
    player.size = vec2.fromValues(100, 20);
    player.velocity = .5;
    player.color = vec3.fromValues(1, 1, 1);
    ball.pos = vec2.add([], player.pos, vec2.fromValues(player.size[0] / 2 - 12.5, -12.5 * 2));
    ball.velocity = vec2.fromValues(.1, -.35);
    ball.stuck = true;
    powers.length = 0;
  }

  gl.useProgram(spriteShader);
  let model = mat4.translate([], mat4.identity([]), vec3.fromValues(0, 0, 10));
  model = mat4.scale(model, model, vec3.fromValues(canvas.width * 2, canvas.height * 2, 1));
  uniformMat4(spriteShader, "model", model);

  let eye = vec3.fromValues(510, 510, -500);
  let at = vec3.fromValues(0, 0, .3);
  let up = vec3.fromValues(0, -1, 0);
  let view = mat4.lookAt([], eye, vec3.add([], eye, at), up);
  uniformMat4(spriteShader, "view", view);

  uniformVec3(spriteShader, "color", vec3.fromValues(1, 1, 1));
  gl.activeTexture(gl.TEXTURE0);
  let bgtexture;
  switch(state) {
    case GameState.ACTIVE:
      bgtexture = backgroundImages[currentLevel];
      break;
    case GameState.MENU:
      bgtexture = menuTexture;
      break;
    case GameState.OVER:
      bgtexture = overTexture;
      break;
  }
  gl.bindTexture(gl.TEXTURE_2D, bgtexture);

  gl.bindBuffer(gl.ARRAY_BUFFER, spriteVBuff);
  gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 5 * 4, 0);
  gl.vertexAttribPointer(vertexTexAttrib, 2, gl.FLOAT, false, 5 * 4, 3 * 4);
  gl.drawArrays(gl.TRIANGLES, 0, 36);

  if(state == GameState.ACTIVE) {
    ball.draw();
    levels[currentLevel].draw();
    player.draw();
    powers.forEach(p => {
    if(!p.destroyed && !p.activated)
      p.draw();
    });
  }
  
  scoreboard.innerHTML = "Score: " + score;
  window.requestAnimationFrame(render);
} // end render triangles

function drawSprite(tex, pos, size, rotate, color, balling) {
  gl.useProgram(spriteShader);
  let model = mat4.translate([], mat4.identity([]), vec3.fromValues(pos[0], pos[1], 0));
  model = mat4.translate(model, model, vec3.fromValues(0.5 * size[0], 0.5 * size[1], 0));
  model = mat4.rotate(model, model, rotate, vec3.fromValues(0, 0, 1));
  model = mat4.translate(model, model, vec3.fromValues(-0.5 * size[0], -0.5 * size[1], 0));
  model = mat4.scale(model, model, vec3.fromValues(size[0], size[1], 10));
  uniformMat4(spriteShader, "model", model);

  let eye = vec3.fromValues(250, 300, -400);
  let at = vec3.fromValues(0, -.1, .3);
  let up = vec3.fromValues(0, -1, 0);
  let view = mat4.lookAt([], eye, vec3.add([], eye, at), up);
  uniformMat4(spriteShader, "view", view);

  uniformVec3(spriteShader, "color", color);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);

  if(balling) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ballIdxBuffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, ballBuffer);
    gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 5 * 4, 0);
    gl.vertexAttribPointer(vertexTexAttrib, 2, gl.FLOAT, false, 5 * 4, 3 * 4);
    gl.drawElements(gl.TRIANGLES, ballIdxCount, gl.UNSIGNED_SHORT, 0);
  }
  else {
    gl.bindBuffer(gl.ARRAY_BUFFER, spriteVBuff);
    gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 5 * 4, 0);
    gl.vertexAttribPointer(vertexTexAttrib, 2, gl.FLOAT, false, 5 * 4, 3 * 4);
    gl.drawArrays(gl.TRIANGLES, 0, 36);
  }
}

function createLevels(filepath, lvlWidth, lvlHeight) {
  let inputLevels = getJSONFile(filepath, "levels data");
  let levels = [];
  inputLevels.forEach((lvl) => {
    let bricks = [];
    let tiles = lvl.tiles;
    let height = tiles.length;
    let width = tiles[0].length;
    let unitHeight = lvlHeight / height;
    let unitWidth = lvlWidth / width;
    for(let y = 0; y < height; y++) {
      for(let x = 0; x < width; x++) {
        if(tiles[y][x] == 1) {
          bricks.push({
            pos : vec2.fromValues(unitWidth * x, unitHeight * y),
            size : vec2.fromValues(unitWidth, unitHeight),
            rot : 0,
            texture : solidBlockTexture,
            color : vec3.fromValues(0.8, 0.8, 0.7),
            solid : true,
            destroyed : false,
            draw : function() {
              drawSprite(this.texture, this.pos, this.size, this.rot, this.color, false);
            }
          });
        }
        else if(tiles[y][x] > 1) {
          let color;
          switch(tiles[y][x]) {
            case 2:
              color = vec3.fromValues(.7, .2, .5);
              break;
            case 3:
              color = vec3.fromValues(0 , .5, 0);
              break;
            case 4:
              color = vec3.fromValues(0.3, 0.1, .7);
              break;
            case 5:
              color = vec3.fromValues(.3, .5, 0);
              break;
          }

          bricks.push({
            pos : vec2.fromValues(unitWidth * x, unitHeight * y),
            size : vec2.fromValues(unitWidth, unitHeight),
            rot : 0,
            texture : blockTexture,
            color : color,
            solid : false,
            destroyed : false,
            draw : function() {
              drawSprite(this.texture, this.pos, this.size, this.rot, this.color, false);
            }
          });
        }
      }
    }

    levels.push({ bricks : bricks, 
      draw : function() {
        this.bricks.forEach(b => {
          if(!b.destroyed)
            b.draw();
        });
      },
      reset : function() {
        this.bricks.forEach(b => {
          b.destroyed = false;
        });
      }
    });
  });

  return levels;
}

function handleInput(dt) {
  if (state == GameState.ACTIVE)
  {
      let velocity = player.velocity * dt;
      if (leftPressed)
      {
        if (player.pos[0] >= 0) {
          player.pos[0] -= velocity;
          if (ball.stuck)
            ball.pos[0] -= velocity;
        }
      }
      if (rightPressed)
      {
        if(player.pos[0] <= canvas.width - player.size[0]) {
          player.pos[0] += velocity;
          if (ball.stuck)
            ball.pos[0] += velocity;
        }
      }
  }
}

function clampVec2(v, vMin, vMax) {
  return vec2.fromValues(Math.max(vMin[0], Math.min(vMax[0], v[0])), Math.max(vMin[1], Math.min(vMax[1], v[1])));
}

// Collision algorithm from learnopengl.com
// https://learnopengl.com/In-Practice/2D-Game/Collisions/Collision-resolution
function checkCollision(ball, other) 
{
    let center = vec2.add([], ball.pos, vec2.fromValues(ball.radius, ball.radius));
    // calculate AABB info (center, half-extents)
    let aabb_half_extents = vec2.fromValues(other.size[0] / 2, other.size[1] / 2);
    let aabb_center = vec2.fromValues(
        other.pos[0] + aabb_half_extents[0], 
        other.pos[1] + aabb_half_extents[1]
    );
    // get difference vector between both centers
    let difference = vec2.subtract([], center, aabb_center);
    let clamped = clampVec2(difference, vec2.fromValues(-aabb_half_extents[0], -aabb_half_extents[1]), aabb_half_extents);
    // add clamped value to AABB_center and we get the value of box closest to circle
    let closest = vec2.add([], aabb_center, clamped);
    // retrieve vector between center circle and closest point AABB and check if length <= radius
    difference = vec2.subtract([], closest, center);
    if(vec2.length(difference) <= ball.radius) 
      return { collided : true, dir : vecDir(difference), diff : difference };
    else
      return { collided : false, dir : Direction.UP, diff : vec2.fromValues(0, 0) };
} 

function aabbCollision(one, two) {
  let collisionX = (one.pos[0] + one.size[0]) >= two.pos[0] &&
    (two.pos[0] + two.size[0]) >= one.pos[0];
  
  let collisionY = (one.pos[1] + one.size[1]) >= two.pos[1] &&
    (two.pos[1] + two.size[1]) >= one.pos[1];

    // collision only if on both axes
    return collisionX && collisionY;
}

const Direction = {
  UP : "Up",
  DOWN : "Down",
  LEFT : "Left",
  RIGHT : "Right"
};

function vecDir(target)
{
    let compass = [
        vec2.fromValues(0, 1),	// up
        vec2.fromValues(1, 0),	// right
        vec2.fromValues(0, -1),	// down
        vec2.fromValues(-1, 0)	// left
    ];
    let max = 0;
    let best_match = -1;
    for (let i = 0; i < 4; i++)
    {
        let dot_product = vec2.dot(vec2.normalize([], target), compass[i]);
        if (dot_product > max)
        {
            max = dot_product;
            best_match = i;
        }
    }

    switch(best_match) {
      case 0:
        return Direction.UP;
      case 1:
        return Direction.RIGHT;
      case 2:
        return Direction.DOWN;
      case 3:
        return Direction.LEFT;
    }
} 

function keyDownHandler(event) {
  if (event.keyCode === 39) {
    rightPressed = true;
  } 
  else if (event.keyCode === 37) {
    leftPressed = true;
  }
  else if(event.keyCode === 32) {
    if(state == GameState.ACTIVE)
      ball.stuck = false;
    else if(state == GameState.MENU)
      state = GameState.ACTIVE;
    else if(state == GameState.OVER) {
      score = 0;
      state = GameState.MENU;
    }
  }
}

function keyUpHandler(event) {
  if (event.keyCode === 39) {
    rightPressed = false;
  } 
  else if (event.keyCode === 37) {
    leftPressed = false;
  }
}

/* MAIN -- HERE is where execution begins after window load */
function main() {
  canvas = document.getElementById("myWebGLCanvas");
  scoreboard = document.getElementById("score");
  scoreboard.innerHTML = "Score: " + score;
  setupWebGL();

  var audio = new Audio('secunda.mp3');
  audio.loop = true;
  audio.play();

  spriteShader = createShader(
    `
    precision highp float;

    attribute vec3 aPos;
    attribute vec2 aTex;

    varying vec2 texCoords;

    uniform mat4 model;
    uniform mat4 view;
    uniform mat4 proj;

    void main(void) {
        texCoords = aTex;
        gl_Position = proj * view * model * vec4(aPos, 1.0); 
    }
  `,
  `
    precision highp float;

    varying vec2 texCoords;

    uniform sampler2D image;
    uniform vec3 color;

    void main(void) {
      gl_FragColor = vec4(color, 1.0) * texture2D(image, texCoords);
      //gl_FragColor = vec4(1, 1, 1, 1);
    }
  `);
  
  gl.useProgram(spriteShader);
  proj = mat4.perspective([], Math.PI / 2, canvas.width / canvas.height, .01, 1000);
  //proj = mat4.ortho([], 0, canvas.width, canvas.height, 0, -1, 1);
  uniformMat4(spriteShader, "proj", proj);
  uniformInt(spriteShader, "image", 0);

  backgroundImages.push(createTexture("tree.jpg"), createTexture("tree2.jpg"), createTexture("tree3.jpg"), createTexture("tree4.jpg"));
  solidBlockTexture = createTexture("tree.jpg");
  blockTexture = createTexture("tree.jpg");
  paddleTexture = createTexture("tree.jpg");
  ballTexture = createTexture("tree.jpg");
  longTexture = createTexture("tree.jpg");
  menuTexture = createTexture("menu.jpg");
  overTexture = createTexture("over.jpg");

  gl.useProgram(spriteShader); // activate shader program (frag and vert)
  vertexPositionAttrib = gl.getAttribLocation(spriteShader, "aPos"); 
  gl.enableVertexAttribArray(vertexPositionAttrib); 
  vertexTexAttrib = gl.getAttribLocation(spriteShader, "aTex"); 
  gl.enableVertexAttribArray(vertexTexAttrib); 

  spriteVBuff = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spriteVBuff);
  var positions = [
    0.0, 1.0, 1, 0.0, 1.0,
    1.0, 0.0, 1, 1.0, 0.0,
    0.0, 0.0, 1, 0.0, 0.0, 
    0.0, 1.0, 1, 0.0, 1.0,
    1.0, 1.0, 1, 1.0, 1.0,
    1.0, 0.0, 1, 1.0, 0.0,

    0.0, 1.0, -1, 0.0, 1.0,
    1.0, 0.0, -1, 1.0, 0.0,
    0.0, 0.0, -1, 0.0, 0.0, 
    0.0, 1.0, -1, 0.0, 1.0,
    1.0, 1.0, -1, 1.0, 1.0,
    1.0, 0.0, -1, 1.0, 0.0,

    0.0, 1.0, -1, 0.0, 1.0,
    0.0, 1.0, 1, 1.0, 1.0,
    0.0, 0.0, -1, 0.0, 0.0, 
    0.0, 0.0, -1, 0.0, 0.0,
    0.0, 0.0, 1, 1.0, 0.0,
    0, 1.0, 1, 1.0, 1.0,

    0, 0, -1, 0, 0,
    0, 0, 1, 0, 1,
    1, 0, 1, 1, 1,
    1, 0, 1, 1, 1,
    1, 0, -1, 1, 0,
    0, 0, -1, 0, 0,

    1, 0, 1, 0, 0,
    1, 0, -1, 1, 0,
    1, 1, -1, 1, 1,
    1, 1, -1, 1, 1,
    1, 1, 1, 0, 1,
    1, 0, 1, 0, 0,

    0, 1, 1, 0, 0,
    0, 1, -1, 0, 1,
    1, 1, -1, 1, 1,
    1, 1, -1, 1, 1,
    1, 1, 1, 1, 0,
    0, 1, 1, 0, 0
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  levels = createLevels("levels.json", canvas.width, canvas.height / 2);
  currentLevel = 0;

  player = {
    pos : vec2.fromValues(canvas.width / 2 - 100 / 2, canvas.height - 20),
    size : vec2.fromValues(100, 20),
    rot : 0,
    texture : paddleTexture,
    color : vec3.fromValues(1, 1, 1),
    velocity : .5,    
    draw : function() {
      drawSprite(this.texture, this.pos, this.size, this.rot, this.color);
    }
  };

  document.addEventListener("keydown", keyDownHandler, false);
  document.addEventListener("keyup", keyUpHandler, false);

  let stacks = 100;
  let sectors = 100;
  let dSec = 2 * Math.PI / sectors;
  let dStack = Math.PI / stacks;
  let vData = [];
  let iData = [];
  
   // Sphere vertices and indices generation algorithm from Song Ho Ahn
   // http://www.songho.ca/opengl/gl_sphere.html
  for(let i = 0; i <= stacks; i++) {
    let phi = Math.PI / 2 - i * dStack;
    let xy = 0.5 * Math.cos(phi);
    let z = 0.5 * Math.sin(phi);
    for(let j = 0; j <= sectors; j++) {
      let theta = j * dSec;
      let x = xy * Math.cos(theta);
      let y = xy * Math.sin(theta);
      vData.push(x, y, z);
      vData.push(j / sectors, i / stacks);
    }
  }

  for(let i = 0; i < stacks; i++) {
      let k1 = i * (sectors + 1);
      let k2 = k1 + sectors + 1;

      for(let j = 0; j < sectors; ++j, ++k1, ++k2) {
          if(i != 0) 
              iData.push(k1, k2, k1 + 1);
          if(i != (stacks - 1)) 
              iData.push(k1 + 1, k2, k2 + 1);
          
      }
  }

  ballIdxCount = iData.length;

  ballBuffer = gl.createBuffer(); // init empty vertex coord buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, ballBuffer); // activate that buffer
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vData), gl.STATIC_DRAW); // coords to that buffer

  // send the triangle indices to webGL
  ballIdxBuffer = gl.createBuffer(); // init empty triangle index buffer
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ballIdxBuffer); // activate that buffer
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(iData), gl.STATIC_DRAW); 

  ball = {
    radius : 12.5,
    pos : vec2.add([], player.pos, vec2.fromValues(player.size[0] / 2 - 12.5, -12.5 * 2)),
    size : vec2.fromValues(12.5 * 2, 12.5 * 2),
    rot : 0,
    texture : ballTexture,
    color : vec3.fromValues(1, 1, 1),
    velocity : vec2.fromValues(.1, -.35),
    stuck : true,
    move : function(dt, width) {
      if(this.stuck)
        return;
      
      this.rot += .001 * dt;
      this.pos[0] += this.velocity[0] * dt;
      this.pos[1] += this.velocity[1] * dt;
      if(this.pos[0] <= 0) {
        this.velocity[0] *= -1;
        this.pos[0] = 0;
      }
      else if((this.pos[0] + this.size[0]) >= width) {
        this.velocity[0] *= -1;
        this.pos[0] = width - this.size[0];
      }
      if(this.pos[1] <= 0) {
        this.velocity[1] *= -1;
        this.pos[1] = 0;
      } 

      return this.pos;
    },
    draw : function() {
      drawSprite(this.texture, this.pos, this.size, this.rot, this.color, true);
    }
  };

  render();
  
} // end main

// setup the webGL shaders
function createShader(vsCode, fsCode) {
    
  // define fragment shader in essl using es6 template strings
  var fShaderCode = fsCode;
  
  // define vertex shader in essl using es6 template strings
  var vShaderCode = vsCode;
  
  try {
      // console.log("fragment shader: "+fShaderCode);
      var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
      gl.shaderSource(fShader,fShaderCode); // attach code to shader
      gl.compileShader(fShader); // compile the code for gpu execution

      // console.log("vertex shader: "+vShaderCode);
      var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
      gl.shaderSource(vShader,vShaderCode); // attach code to shader
      gl.compileShader(vShader); // compile the code for gpu execution
          
      if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
          throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
          gl.deleteShader(fShader);
      } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
          throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
          gl.deleteShader(vShader);
      } else { // no compile errors
          var shaderProgram = gl.createProgram(); // create the single shader program
          gl.attachShader(shaderProgram, fShader); // put frag shader in program
          gl.attachShader(shaderProgram, vShader); // put vertex shader in program
          gl.linkProgram(shaderProgram); // link program into gl context

          if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
              throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
          }
          else {
            return shaderProgram;
          }
      } // end if no compile errors
  } // end try 
  
  catch(e) {
      console.log(e);
  } // end catch
} // end setup shaders

function uniformMat4(shader, name, v) {
let loc = gl.getUniformLocation(shader, name);
  if(loc < 0)
      console.error(name + " is not found in shader");
  else
      gl.uniformMatrix4fv(loc, false, v);
}

function uniformVec3(shader, name, v) {
  let loc = gl.getUniformLocation(shader, name);
  if(loc < 0)
      console.error(name + " is not found in shader");
  else
      gl.uniform3f(loc, v[0], v[1], v[2]);
}

function uniformInt(shader, name, v) {
let loc = gl.getUniformLocation(shader, name);
if(loc < 0)
    console.error(name + " is not found in shader");
else
    gl.uniform1i(loc, v);
}

// set up the webGL environment
function setupWebGL() {

  // Get the canvas and context
  gl = canvas.getContext("webgl2"); // get a webgl object from it
  
  try {
    if (gl == null) {
      throw "unable to create gl context -- is your browser gl ready?";
    } else {
      gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
      gl.clearDepth(1.0); // use max when we clear the depth buffer
      gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
  } // end try
  
  catch(e) {
    console.log(e);
  } // end catch

} // end setupWebGL

function createTexture(filepath) {
// Create a texture.
var texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);

// Fill the texture with a 1x1 blue pixel.
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
              new Uint8Array([0, 0, 255, 255]));

// Asynchronously load an image
var image = new Image();
image.src = filepath;
image.addEventListener('load', function() {
  // Now that the image has loaded make copy it to the texture.
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, image);
  gl.generateMipmap(gl.TEXTURE_2D);
});

return texture;
}

function getJSONFile(url,descr) {
try {
    if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
        throw "getJSONFile: parameter not a string";
    else {
        var httpReq = new XMLHttpRequest(); // a new http request
        httpReq.open("GET",url,false); // init the request
        httpReq.send(null); // send the request
        var startTime = Date.now();
        while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
            if ((Date.now()-startTime) > 3000)
                break;
        } // until its loaded or we time out after three seconds
        if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
            throw "Unable to open "+descr+" file!";
        else
            return JSON.parse(httpReq.response);
    } // end if good params
} // end try

catch(e) {
    console.log(e);
    return(String.null);
}
} // end get input spheres