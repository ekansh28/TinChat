// This file is auto-generated from JSDoc documentation

import p5 from 'p5';

declare module 'p5' {
/**
 * Influences the shape of the Bézier curve segment in a custom shape.
 * By default, this is 3; the other possible parameter is 2. This
 * results in quadratic Bézier curves.`bezierVertex()` adds a curved segment to custom shapes. The Bézier curves
 * it creates are defined like those made by the
 * bezier() function. `bezierVertex()` must be
 * called between the
 * beginShape() and
 * endShape() functions. There must be at least
 * one call to bezierVertex(), before
 * a number of `bezierVertex()` calls that is a multiple of the parameter
 * set by bezierOrder(...) (default 3).Each curve of order 3 requires three calls to `bezierVertex`, so
 * 2 curves would need 7 calls to `bezierVertex()`:
 * (1 one initial anchor point, two sets of 3 curves describing the curves)
 * With `bezierOrder(2)`, two curves would need 5 calls: 1 + 2 + 2.Bézier curves can also be drawn in 3D using WebGL mode.Note: `bezierVertex()` won’t work when an argument is passed to
 * beginShape().
 *
 * @param The new order to set. Can be either 2 or 3, by default 3
 * @example <div>
 * <code>
 * function setup() {
 * createCanvas(100, 100);
 * 
 * background(200);
 * 
 * // Style the shape.
 * noFill();
 * 
 * // Start drawing the shape.
 * beginShape();
 * 
 * // set the order to 2 for a quadratic Bézier curve
 * bezierOrder(2);
 * 
 * // Add the first anchor point.
 * bezierVertex(30, 20);
 * 
 * // Add the Bézier vertex.
 * bezierVertex(80, 20);
 * bezierVertex(50, 50);
 * 
 * // Stop drawing the shape.
 * endShape();
 * 
 * describe('A black curve drawn on a gray square. The curve starts at the top-left corner and ends at the center.');
 * }
 * </code>
 * </div>
 */
function bezierOrder(order: number): void;

/**
 * @returns The current Bézier order.
 */
function bezierOrder(): number;

/**
 * Adds a spline curve segment to a custom shape.`splineVertex()` adds a curved segment to custom shapes. The spline curves
 * it creates are defined like those made by the
 * curve() function. `splineVertex()` must be called
 * between the beginShape() and
 * endShape() functions.Spline curves can form shapes and curves that slope gently. They’re like
 * cables that are attached to a set of points. Splines are defined by two
 * anchor points and two control points. `splineVertex()` must be called at
 * least four times between
 * beginShape() and
 * endShape() in order to draw a curve:`beginShape();
 * 
 * // Add the first control point.
 * splineVertex(84, 91);
 * 
 * // Add the anchor points to draw between.
 * splineVertex(68, 19);
 * splineVertex(21, 17);
 * 
 * // Add the second control point.
 * splineVertex(32, 91);
 * 
 * endShape();`The code snippet above would only draw the curve between the anchor points,
 * similar to the curve() function. The segments
 * between the control and anchor points can be drawn by calling
 * `splineVertex()` with the coordinates of the control points:`beginShape();
 * 
 * // Add the first control point and draw a segment to it.
 * splineVertex(84, 91);
 * splineVertex(84, 91);
 * 
 * // Add the anchor points to draw between.
 * splineVertex(68, 19);
 * splineVertex(21, 17);
 * 
 * // Add the second control point.
 * splineVertex(32, 91);
 * 
 * // Uncomment the next line to draw the segment to the second control point.
 * // splineVertex(32, 91);
 * 
 * endShape();`The first two parameters, `x` and `y`, set the vertex’s location. For
 * example, calling `splineVertex(10, 10)` adds a point to the curve at
 * `(10, 10)`.Spline curves can also be drawn in 3D using WebGL mode. The 3D version of
 * `splineVertex()` has three arguments because each point has x-, y-, and
 * z-coordinates. By default, the vertex’s z-coordinate is set to 0.Note: `splineVertex()` won’t work when an argument is passed to
 * beginShape().
 *
 * @param x-coordinate of the vertex
 * @param y-coordinate of the vertex
 * @example <div>
 * <code>
 * function setup() {
 * createCanvas(100, 100);
 * 
 * background(200);
 * 
 * // Style the shape.
 * noFill();
 * strokeWeight(1);
 * 
 * // Start drawing the shape.
 * beginShape();
 * 
 * // Add the first control point.
 * splineVertex(32, 91);
 * 
 * // Add the anchor points.
 * splineVertex(21, 17);
 * splineVertex(68, 19);
 * 
 * // Add the second control point.
 * splineVertex(84, 91);
 * 
 * // Stop drawing the shape.
 * endShape();
 * 
 * // Style the anchor and control points.
 * strokeWeight(5);
 * 
 * // Draw the anchor points in black.
 * stroke(0);
 * point(21, 17);
 * point(68, 19);
 * 
 * // Draw the control points in red.
 * stroke(255, 0, 0);
 * point(32, 91);
 * point(84, 91);
 * 
 * describe(
 * 'A black curve drawn on a gray background. The curve has black dots at its ends. Two red dots appear near the bottom of the canvas.'
 * );
 * }
 * </code>
 * </div>
 * 
 * <div>
 * <code>
 * function setup() {
 * createCanvas(100, 100);
 * 
 * background(200);
 * 
 * // Style the shape.
 * noFill();
 * strokeWeight(1);
 * 
 * // Start drawing the shape.
 * beginShape();
 * 
 * // Add the first control point and draw a segment to it.
 * splineVertex(32, 91);
 * splineVertex(32, 91);
 * 
 * // Add the anchor points.
 * splineVertex(21, 17);
 * splineVertex(68, 19);
 * 
 * // Add the second control point.
 * splineVertex(84, 91);
 * 
 * // Stop drawing the shape.
 * endShape();
 * 
 * // Style the anchor and control points.
 * strokeWeight(5);
 * 
 * // Draw the anchor points in black.
 * stroke(0);
 * point(21, 17);
 * point(68, 19);
 * 
 * // Draw the control points in red.
 * stroke(255, 0, 0);
 * point(32, 91);
 * point(84, 91);
 * 
 * describe(
 * 'A black curve drawn on a gray background. The curve passes through one red dot and two black dots. Another red dot appears near the bottom of the canvas.'
 * );
 * }
 * </code>
 * </div>
 * 
 * <div>
 * <code>
 * function setup() {
 * createCanvas(100, 100);
 * 
 * background(200);
 * 
 * // Style the shape.
 * noFill();
 * strokeWeight(1);
 * 
 * // Start drawing the shape.
 * beginShape();
 * 
 * // Add the first control point and draw a segment to it.
 * splineVertex(32, 91);
 * splineVertex(32, 91);
 * 
 * // Add the anchor points.
 * splineVertex(21, 17);
 * splineVertex(68, 19);
 * 
 * // Add the second control point and draw a segment to it.
 * splineVertex(84, 91);
 * splineVertex(84, 91);
 * 
 * // Stop drawing the shape.
 * endShape();
 * 
 * // Style the anchor and control points.
 * strokeWeight(5);
 * 
 * // Draw the anchor points in black.
 * stroke(0);
 * point(21, 17);
 * point(68, 19);
 * 
 * // Draw the control points in red.
 * stroke(255, 0, 0);
 * point(32, 91);
 * point(84, 91);
 * 
 * describe(
 * 'A black U curve drawn upside down on a gray background. The curve passes from one red dot through two black dots and ends at another red dot.'
 * );
 * }
 * </code>
 * </div>
 * 
 * <div>
 * <code>
 * // Click the mouse near the red dot in the bottom-left corner
 * // and drag to change the curve's shape.
 * 
 * let x1 = 32;
 * let y1 = 91;
 * let isChanging = false;
 * 
 * function setup() {
 * createCanvas(100, 100);
 * 
 * describe(
 * 'A black U curve drawn upside down on a gray background. The curve passes from one red dot through two black dots and ends at another red dot.'
 * );
 * }
 * 
 * function draw() {
 * background(200);
 * 
 * // Style the shape.
 * noFill();
 * stroke(0);
 * strokeWeight(1);
 * 
 * // Start drawing the shape.
 * beginShape();
 * 
 * // Add the first control point and draw a segment to it.
 * splineVertex(x1, y1);
 * splineVertex(x1, y1);
 * 
 * // Add the anchor points.
 * splineVertex(21, 17);
 * splineVertex(68, 19);
 * 
 * // Add the second control point and draw a segment to it.
 * splineVertex(84, 91);
 * splineVertex(84, 91);
 * 
 * // Stop drawing the shape.
 * endShape();
 * 
 * // Style the anchor and control points.
 * strokeWeight(5);
 * 
 * // Draw the anchor points in black.
 * stroke(0);
 * point(21, 17);
 * point(68, 19);
 * 
 * // Draw the control points in red.
 * stroke(255, 0, 0);
 * point(x1, y1);
 * point(84, 91);
 * }
 * 
 * // Start changing the first control point if the user clicks near it.
 * function mousePressed() {
 * if (dist(mouseX, mouseY, x1, y1) < 20) {
 * isChanging = true;
 * }
 * }
 * 
 * // Stop changing the first control point when the user releases the mouse.
 * function mouseReleased() {
 * isChanging = false;
 * }
 * 
 * // Update the first control point while the user drags the mouse.
 * function mouseDragged() {
 * if (isChanging === true) {
 * x1 = mouseX;
 * y1 = mouseY;
 * }
 * }
 * </code>
 * </div>
 * 
 * <div>
 * <code>
 * function setup() {
 * createCanvas(100, 100);
 * 
 * background(200);
 * 
 * // Start drawing the shape.
 * beginShape();
 * 
 * // Add the first control point and draw a segment to it.
 * splineVertex(32, 91);
 * splineVertex(32, 91);
 * 
 * // Add the anchor points.
 * splineVertex(21, 17);
 * splineVertex(68, 19);
 * 
 * // Add the second control point.
 * splineVertex(84, 91);
 * splineVertex(84, 91);
 * 
 * // Stop drawing the shape.
 * endShape();
 * 
 * describe('A ghost shape drawn in white on a gray background.');
 * }
 * </code>
 * </div>
 */
function splineVertex(x: number, y: number): void;

/**
 * @param z-coordinate of the vertex.
 * @example <div>
 * <code>
 * // Click and drag the mouse to view the scene from different angles.
 * 
 * function setup() {
 * createCanvas(100, 100, WEBGL);
 * 
 * describe('A ghost shape drawn in white on a blue background. When the user drags the mouse, the scene rotates to reveal the outline of a second ghost.');
 * }
 * 
 * function draw() {
 * background('midnightblue');
 * 
 * // Enable orbiting with the mouse.
 * orbitControl();
 * 
 * // Draw the first ghost.
 * noStroke();
 * fill('ghostwhite');
 * 
 * beginShape();
 * splineVertex(-28, 41, 0);
 * splineVertex(-28, 41, 0);
 * splineVertex(-29, -33, 0);
 * splineVertex(18, -31, 0);
 * splineVertex(34, 41, 0);
 * splineVertex(34, 41, 0);
 * endShape();
 * 
 * // Draw the second ghost.
 * noFill();
 * stroke('ghostwhite');
 * 
 * beginShape();
 * splineVertex(-28, 41, -20);
 * splineVertex(-28, 41, -20);
 * splineVertex(-29, -33, -20);
 * splineVertex(18, -31, -20);
 * splineVertex(34, 41, -20);
 * splineVertex(34, 41, -20);
 * endShape();
 * }
 * </code>
 * </div>
 */
function splineVertex(x: number, y: number, z?: number): void;

/**
 */
function splineVertex(x: number, y: number, u: number, v: number): void;

/**
 */
function splineVertex(x: number, y: number, z: number, u: number, v: number): void;

/**
 * Sets the property of a curve.For example, set tightness,
 * use `splineProperty('tightness', t)`, with `t` between 0 and 1,
 * at 0 as default.Spline curves are like cables that are attached to a set of points.
 * Adjusting tightness adjusts how tightly the cable is
 * attached to the points. The parameter, tightness, determines
 * how the curve fits to the vertex points. By default,
 * tightness is set to 0. Setting tightness to 1, as in
 * `splineProperty('tightness', 1)`, connects the curve's points
 * using straight lines. Values in the range from –5 to 5
 * deform curves while leaving them recognizable.This function can also be used to set 'ends' property
 * (see also: the curveDetail() example),
 * such as: `splineProperty('ends', EXCLUDE)` to exclude
 * vertices, or `splineProperty('ends', INCLUDE)` to include them.
 *
 * @param Value to set the given property to.
 * @example <div>
 * <code>
 * // Move the mouse left and right to see the curve change.
 * 
 * function setup() {
 * createCanvas(100, 100);
 * describe('A black curve forms a sideways U shape. The curve deforms as the user moves the mouse from left to right');
 * }
 * 
 * function draw() {
 * background(200);
 * 
 * // Set the curve's tightness using the mouse.
 * let t = map(mouseX, 0, 100, -5, 5, true);
 * splineProperty('tightness', t);
 * 
 * // Draw the curve.
 * noFill();
 * beginShape();
 * splineVertex(10, 26);
 * splineVertex(10, 26);
 * splineVertex(83, 24);
 * splineVertex(83, 61);
 * splineVertex(25, 65);
 * splineVertex(25, 65);
 * endShape();
 * }
 * </code>
 * </div>
 */
function splineProperty(property: string, value: any): void;

/**
 * @returns The current value for the given property.
 */
function splineProperty(property: string): void;

/**
 * Get or set multiple spline properties at once.Similar to splineProperty():
 * `splineProperty('tightness', t)` is the same as
 * `splineProperties({'tightness': t})`
 *
 * @param An object containing key-value pairs to set.
 */
function splineProperties(properties: object): void;

/**
 * @returns The current spline properties.
 */
function splineProperties(): object;

/**
 * Adds a vertex to a custom shape.`vertex()` sets the coordinates of vertices drawn between the
 * beginShape() and
 * endShape() functions.The first two parameters, `x` and `y`, set the x- and y-coordinates of the
 * vertex.The third parameter, `z`, is optional. It sets the z-coordinate of the
 * vertex in WebGL mode. By default, `z` is 0.The fourth and fifth parameters, `u` and `v`, are also optional. They set
 * the u- and v-coordinates for the vertex’s texture when used with
 * endShape(). By default, `u` and `v` are both 0.
 *
 * @param x-coordinate of the vertex.
 * @param y-coordinate of the vertex.
 * @example <div>
 * <code>
 * function setup() {
 * createCanvas(100, 100);
 * 
 * background(200);
 * 
 * // Style the shape.
 * strokeWeight(3);
 * 
 * // Start drawing the shape.
 * // Only draw the vertices.
 * beginShape(POINTS);
 * 
 * // Add the vertices.
 * vertex(30, 20);
 * vertex(85, 20);
 * vertex(85, 75);
 * vertex(30, 75);
 * 
 * // Stop drawing the shape.
 * endShape();
 * 
 * describe('Four black dots that form a square are drawn on a gray background.');
 * }
 * </code>
 * </div>
 * 
 * <div>
 * <code>
 * function setup() {
 * createCanvas(100, 100);
 * 
 * background(200);
 * 
 * // Start drawing the shape.
 * beginShape();
 * 
 * // Add vertices.
 * vertex(30, 20);
 * vertex(85, 20);
 * vertex(85, 75);
 * vertex(30, 75);
 * 
 * // Stop drawing the shape.
 * endShape(CLOSE);
 * 
 * describe('A white square on a gray background.');
 * }
 * </code>
 * </div>
 * 
 * <div>
 * <code>
 * function setup() {
 * createCanvas(100, 100, WEBGL);
 * 
 * background(200);
 * 
 * // Start drawing the shape.
 * beginShape();
 * 
 * // Add vertices.
 * vertex(-20, -30, 0);
 * vertex(35, -30, 0);
 * vertex(35, 25, 0);
 * vertex(-20, 25, 0);
 * 
 * // Stop drawing the shape.
 * endShape(CLOSE);
 * 
 * describe('A white square on a gray background.');
 * }
 * </code>
 * </div>
 * 
 * <div>
 * <code>
 * function setup() {
 * createCanvas(100, 100, WEBGL);
 * 
 * describe('A white square spins around slowly on a gray background.');
 * }
 * 
 * function draw() {
 * background(200);
 * 
 * // Rotate around the y-axis.
 * rotateY(frameCount * 0.01);
 * 
 * // Start drawing the shape.
 * beginShape();
 * 
 * // Add vertices.
 * vertex(-20, -30, 0);
 * vertex(35, -30, 0);
 * vertex(35, 25, 0);
 * vertex(-20, 25, 0);
 * 
 * // Stop drawing the shape.
 * endShape(CLOSE);
 * }
 * </code>
 * </div>
 * 
 * <div>
 * <code>
 * let img;
 * 
 * async function setup() {
 * // Load an image to apply as a texture.
 * img = await loadImage('assets/laDefense.jpg');
 * 
 * createCanvas(100, 100, WEBGL);
 * 
 * describe('A photograph of a ceiling rotates slowly against a gray background.');
 * }
 * 
 * function draw() {
 * background(200);
 * 
 * // Rotate around the y-axis.
 * rotateY(frameCount * 0.01);
 * 
 * // Style the shape.
 * noStroke();
 * 
 * // Apply the texture.
 * texture(img);
 * textureMode(NORMAL);
 * 
 * // Start drawing the shape
 * beginShape();
 * 
 * // Add vertices.
 * vertex(-20, -30, 0, 0, 0);
 * vertex(35, -30, 0, 1, 0);
 * vertex(35, 25, 0, 1, 1);
 * vertex(-20, 25, 0, 0, 1);
 * 
 * // Stop drawing the shape.
 * endShape();
 * }
 * </code>
 * </div>
 * 
 * <div>
 * <code>
 * let vid;
 * function setup() {
 * // Load a video and create a p5.MediaElement object.
 * vid = createVideo('/assets/fingers.mov');
 * createCanvas(100, 100, WEBGL);
 * 
 * // Hide the video.
 * vid.hide();
 * 
 * // Set the video to loop.
 * vid.loop();
 * 
 * describe('A rectangle with video as texture');
 * }
 * 
 * function draw() {
 * background(0);
 * 
 * // Rotate around the y-axis.
 * rotateY(frameCount * 0.01);
 * 
 * // Set the texture mode.
 * textureMode(NORMAL);
 * 
 * // Apply the video as a texture.
 * texture(vid);
 * 
 * // Draw a custom shape using uv coordinates.
 * beginShape();
 * vertex(-40, -40, 0, 0);
 * vertex(40, -40, 1, 0);
 * vertex(40, 40, 1, 1);
 * vertex(-40, 40, 0, 1);
 * endShape();
 * }
 * </code>
 * </div>
 */
function vertex(x: number, y: number): void;

/**
 * @param u-coordinate of the vertex's texture.
 * @param v-coordinate of the vertex's texture.
 */
function vertex(x: number, y: number, u: number, v: number): void;

/**
 * @param u-coordinate of the vertex's texture.
 * @param v-coordinate of the vertex's texture.
 */
function vertex(x: number, y: number, z: number, u: number, v: number): void;

/**
 * Begins creating a hole within a flat shape.The `beginContour()` and endContour()
 * functions allow for creating negative space within custom shapes that are
 * flat. `beginContour()` begins adding vertices to a negative space and
 * endContour() stops adding them.
 * `beginContour()` and endContour() must be
 * called between beginShape() and
 * endShape().Transformations such as translate(),
 * rotate(), and scale()
 * don't work between `beginContour()` and
 * endContour(). It's also not possible to use
 * other shapes, such as ellipse() or
 * rect(), between `beginContour()` and
 * endContour().Note: The vertices that define a negative space must "wind" in the opposite
 * direction from the outer shape. First, draw vertices for the outer shape
 * clockwise order. Then, draw vertices for the negative space in
 * counter-clockwise order.
 *
 * @example <div>
 * <code>
 * function setup() {
 * createCanvas(100, 100);
 * 
 * background(200);
 * 
 * // Start drawing the shape.
 * beginShape();
 * 
 * // Exterior vertices, clockwise winding.
 * vertex(10, 10);
 * vertex(90, 10);
 * vertex(90, 90);
 * vertex(10, 90);
 * 
 * // Interior vertices, counter-clockwise winding.
 * beginContour();
 * vertex(30, 30);
 * vertex(30, 70);
 * vertex(70, 70);
 * vertex(70, 30);
 * endContour(CLOSE);
 * 
 * // Stop drawing the shape.
 * endShape(CLOSE);
 * 
 * describe('A white square with a square hole in its center drawn on a gray background.');
 * }
 * </code>
 * </div>
 * 
 * <div>
 * <code>
 * // Click and drag the mouse to view the scene from different angles.
 * 
 * function setup() {
 * createCanvas(100, 100, WEBGL);
 * 
 * describe('A white square with a square hole in its center drawn on a gray background.');
 * }
 * 
 * function draw() {
 * background(200);
 * 
 * // Enable orbiting with the mouse.
 * orbitControl();
 * 
 * // Start drawing the shape.
 * beginShape();
 * 
 * // Exterior vertices, clockwise winding.
 * vertex(-40, -40);
 * vertex(40, -40);
 * vertex(40, 40);
 * vertex(-40, 40);
 * 
 * // Interior vertices, counter-clockwise winding.
 * beginContour();
 * vertex(-20, -20);
 * vertex(-20, 20);
 * vertex(20, 20);
 * vertex(20, -20);
 * endContour(CLOSE);
 * 
 * // Stop drawing the shape.
 * endShape(CLOSE);
 * }
 * </code>
 * </div>
 */
function beginContour(): void;

/**
 * Stops creating a hole within a flat shape.The beginContour() and `endContour()`
 * functions allow for creating negative space within custom shapes that are
 * flat. beginContour() begins adding vertices
 * to a negative space and `endContour()` stops adding them.
 * beginContour() and `endContour()` must be
 * called between beginShape() and
 * endShape().By default,
 * the controur has an `OPEN` end, and to close it,
 * call `endContour(CLOSE)`. The CLOSE contour mode closes splines smoothly.Transformations such as translate(),
 * rotate(), and scale()
 * don't work between beginContour() and
 * `endContour()`. It's also not possible to use other shapes, such as
 * ellipse() or rect(),
 * between beginContour() and `endContour()`.Note: The vertices that define a negative space must "wind" in the opposite
 * direction from the outer shape. First, draw vertices for the outer shape
 * clockwise order. Then, draw vertices for the negative space in
 * counter-clockwise order.
 *
 * @param By default, the value is OPEN
 * @example <div>
 * <code>
 * function setup() {
 * createCanvas(100, 100);
 * 
 * background(200);
 * 
 * // Start drawing the shape.
 * beginShape();
 * 
 * // Exterior vertices, clockwise winding.
 * vertex(10, 10);
 * vertex(90, 10);
 * vertex(90, 90);
 * vertex(10, 90);
 * 
 * // Interior vertices, counter-clockwise winding.
 * beginContour();
 * vertex(30, 30);
 * vertex(30, 70);
 * vertex(70, 70);
 * vertex(70, 30);
 * endContour(CLOSE);
 * 
 * // Stop drawing the shape.
 * endShape(CLOSE);
 * 
 * describe('A white square with a square hole in its center drawn on a gray background.');
 * }
 * </code>
 * </div>
 * 
 * <div>
 * <code>
 * // Click and drag the mouse to view the scene from different angles.
 * 
 * function setup() {
 * createCanvas(100, 100, WEBGL);
 * 
 * describe('A white square with a square hole in its center drawn on a gray background.');
 * }
 * 
 * function draw() {
 * background(200);
 * 
 * // Enable orbiting with the mouse.
 * orbitControl();
 * 
 * // Start drawing the shape.
 * beginShape();
 * 
 * // Exterior vertices, clockwise winding.
 * vertex(-40, -40);
 * vertex(40, -40);
 * vertex(40, 40);
 * vertex(-40, 40);
 * 
 * // Interior vertices, counter-clockwise winding.
 * beginContour();
 * vertex(-20, -20);
 * vertex(-20, 20);
 * vertex(20, 20);
 * vertex(20, -20);
 * endContour(CLOSE);
 * 
 * // Stop drawing the shape.
 * endShape(CLOSE);
 * }
 * </code>
 * </div>
 */
function endContour(mode: OPEN | CLOSE): void;

}

export default function custom_shapes(p5: any, fn: any): void;
