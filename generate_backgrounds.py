#!/usr/bin/env python3
"""
Generate background images from CSS gradients
"""
from PIL import Image, ImageDraw
import math

def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def create_gradient(width, height, colors, angle=135):
    """
    Create a gradient image
    colors: list of (position, color) tuples where position is 0-1
    angle: gradient angle in degrees (0 = horizontal, 90 = vertical)
    """
    image = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(image)
    
    # Convert angle to radians
    angle_rad = math.radians(angle)
    
    # Calculate gradient direction
    cos_angle = math.cos(angle_rad)
    sin_angle = math.sin(angle_rad)
    
    # For each pixel, calculate its position along the gradient line
    for y in range(height):
        for x in range(width):
            # Normalize coordinates to -1 to 1
            nx = (x / width) * 2 - 1
            ny = (y / height) * 2 - 1
            
            # Calculate position along gradient line (0 to 1)
            t = (nx * cos_angle + ny * sin_angle + math.sqrt(2)) / (2 * math.sqrt(2))
            t = max(0, min(1, t))  # Clamp to 0-1
            
            # Find the two colors to interpolate between
            color = None
            for i in range(len(colors) - 1):
                pos1, col1 = colors[i]
                pos2, col2 = colors[i + 1]
                
                if pos1 <= t <= pos2:
                    # Interpolate between col1 and col2
                    local_t = (t - pos1) / (pos2 - pos1)
                    r = int(col1[0] + (col2[0] - col1[0]) * local_t)
                    g = int(col1[1] + (col2[1] - col1[1]) * local_t)
                    b = int(col1[2] + (col2[2] - col1[2]) * local_t)
                    color = (r, g, b)
                    break
            
            if color is None:
                color = colors[0][1] if t < colors[0][0] else colors[-1][1]
            
            image.putpixel((x, y), color)
    
    return image

def main():
    # Light mode gradient 1: linear-gradient(135deg, #E8D5D2 0%, #C5D5EA 50%, #D4CCE8 100%)
    light_gradient_1_colors = [
        (0.0, hex_to_rgb('#E8D5D2')),   # Rose Quartz Light
        (0.5, hex_to_rgb('#C5D5EA')),   # Serenity Blue Light
        (1.0, hex_to_rgb('#D4CCE8'))    # Lavender Gray Light
    ]
    
    # Light mode gradient 2: linear-gradient(135deg, #F8E5E0 0%, #D4E4F7 50%, #E6DDF5 100%)
    light_gradient_2_colors = [
        (0.0, hex_to_rgb('#F8E5E0')),
        (0.5, hex_to_rgb('#D4E4F7')),
        (1.0, hex_to_rgb('#E6DDF5'))
    ]
    
    # Dark mode gradient 1: linear-gradient(135deg, #1a1f2e 0%, #0f1419 50%, #1a1f2e 100%)
    dark_gradient_1_colors = [
        (0.0, hex_to_rgb('#1a1f2e')),
        (0.5, hex_to_rgb('#0f1419')),
        (1.0, hex_to_rgb('#1a1f2e'))
    ]
    
    # Dark mode gradient 2: linear-gradient(135deg, #2a2f3e 0%, #1f242e 50%, #2a2f3e 100%)
    dark_gradient_2_colors = [
        (0.0, hex_to_rgb('#2a2f3e')),
        (0.5, hex_to_rgb('#1f242e')),
        (1.0, hex_to_rgb('#2a2f3e'))
    ]
    
    # Generate images in multiple resolutions
    resolutions = [
        (1920, 1080, 'fhd'),
        (2560, 1440, '2k'),
        (3840, 2160, '4k'),
        (1366, 768, 'hd'),
        (1536, 864, 'hd_plus')
    ]
    
    gradients = [
        ('light_mode_gradient_1', light_gradient_1_colors),
        ('light_mode_gradient_2', light_gradient_2_colors),
        ('dark_mode_gradient_1', dark_gradient_1_colors),
        ('dark_mode_gradient_2', dark_gradient_2_colors)
    ]
    
    print("🎨 Generating background images...")
    
    for gradient_name, colors in gradients:
        for width, height, res_name in resolutions:
            filename = f'exports/backgrounds/{gradient_name}_{res_name}_{width}x{height}.png'
            print(f"   Creating {filename}...")
            
            img = create_gradient(width, height, colors, angle=135)
            img.save(filename, 'PNG', optimize=True)
    
    print("\n✅ All background images generated successfully!")
    print(f"   Total: {len(gradients) * len(resolutions)} images")
    print(f"   Resolutions: {', '.join([f'{w}x{h}' for w, h, _ in resolutions])}")

if __name__ == '__main__':
    main()
