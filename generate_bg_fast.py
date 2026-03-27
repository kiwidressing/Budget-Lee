#!/usr/bin/env python3
from PIL import Image
import numpy as np

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return [int(hex_color[i:i+2], 16) for i in (0, 2, 4)]

def create_gradient_fast(width, height, colors_list, angle=135):
    """Fast gradient using numpy"""
    # Create coordinate grids
    x = np.linspace(0, 1, width)
    y = np.linspace(0, 1, height)
    X, Y = np.meshgrid(x, y)
    
    # Calculate gradient direction (135 degrees)
    angle_rad = np.radians(angle)
    t = (X * np.cos(angle_rad) + Y * np.sin(angle_rad))
    t = (t - t.min()) / (t.max() - t.min())  # Normalize to 0-1
    
    # Create RGB channels
    img_array = np.zeros((height, width, 3), dtype=np.uint8)
    
    for i in range(len(colors_list) - 1):
        pos1, col1 = colors_list[i]
        pos2, col2 = colors_list[i + 1]
        
        # Create mask for this segment
        mask = (t >= pos1) & (t <= pos2)
        
        # Calculate interpolation factor
        local_t = np.clip((t - pos1) / (pos2 - pos1), 0, 1)
        
        for channel in range(3):
            img_array[:, :, channel] = np.where(
                mask,
                col1[channel] + (col2[channel] - col1[channel]) * local_t,
                img_array[:, :, channel]
            )
    
    return Image.fromarray(img_array)

# Gradients
gradients = {
    'light_1': [(0.0, hex_to_rgb('#E8D5D2')), (0.5, hex_to_rgb('#C5D5EA')), (1.0, hex_to_rgb('#D4CCE8'))],
    'light_2': [(0.0, hex_to_rgb('#F8E5E0')), (0.5, hex_to_rgb('#D4E4F7')), (1.0, hex_to_rgb('#E6DDF5'))],
    'dark_1': [(0.0, hex_to_rgb('#1a1f2e')), (0.5, hex_to_rgb('#0f1419')), (1.0, hex_to_rgb('#1a1f2e'))],
    'dark_2': [(0.0, hex_to_rgb('#2a2f3e')), (0.5, hex_to_rgb('#1f242e')), (1.0, hex_to_rgb('#2a2f3e'))]
}

resolutions = [(1920, 1080, 'fhd'), (1366, 768, 'hd')]

print("🎨 Generating backgrounds...")
for name, colors in gradients.items():
    for w, h, res in resolutions:
        file = f'exports/backgrounds/bg_{name}_{res}_{w}x{h}.png'
        print(f"  {file}")
        img = create_gradient_fast(w, h, colors)
        img.save(file, 'PNG', optimize=True)
print("✅ Done!")
