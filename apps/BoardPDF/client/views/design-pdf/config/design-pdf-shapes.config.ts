interface ShapeDefinition {
  cardHtml: string;
  nameKey: string;
  shape: string;
}

interface ShapeCategory {
  id: string;
  shapes: ShapeDefinition[];
  titleKey: string;
}

const SHAPES_CATALOG: Record<string, ShapeCategory> = {
  "lines": {
    "id": "lines",
    "titleKey": "collaborative.shape_cat_lines",
    "shapes": [
      {
        "shape": "line-solid",
        "nameKey": "collaborative.shape_line_solid",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-line-solid\" data-shape=\"line-solid\" data-i18n-tooltip=\"collaborative.shape_line_solid\" data-i18n-aria=\"collaborative.shape_line_solid\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><line x1=\"4\" y1=\"20\" x2=\"36\" y2=\"20\" stroke=\"#000000\" stroke-width=\"2.5\"/></svg> </button>"
      },
      {
        "shape": "line-dashed",
        "nameKey": "collaborative.shape_line_dashed",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-line-dashed\" data-shape=\"line-dashed\" data-i18n-tooltip=\"collaborative.shape_line_dashed\" data-i18n-aria=\"collaborative.shape_line_dashed\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><line x1=\"4\" y1=\"20\" x2=\"36\" y2=\"20\" stroke=\"#000000\" stroke-width=\"2.5\" stroke-dasharray=\"5 3\"/></svg> </button>"
      },
      {
        "shape": "line-dotted",
        "nameKey": "collaborative.shape_line_dotted",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-line-dotted\" data-shape=\"line-dotted\" data-i18n-tooltip=\"collaborative.shape_line_dotted\" data-i18n-aria=\"collaborative.shape_line_dotted\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><line x1=\"4\" y1=\"20\" x2=\"36\" y2=\"20\" stroke=\"#000000\" stroke-width=\"2.5\" stroke-dasharray=\"1 3.5\" stroke-linecap=\"round\"/></svg> </button>"
      },
      {
        "shape": "line-arrow-solid",
        "nameKey": "collaborative.shape_line_arrow_solid",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-line-arrow-solid\" data-shape=\"line-arrow-solid\" data-i18n-tooltip=\"collaborative.shape_line_arrow_solid\" data-i18n-aria=\"collaborative.shape_line_arrow_solid\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><line x1=\"4\" y1=\"20\" x2=\"30\" y2=\"20\" stroke=\"#000000\" stroke-width=\"2.5\"/><polygon points=\"28,15 36,20 28,25\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "line-arrow-dashed",
        "nameKey": "collaborative.shape_line_arrow_dashed",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-line-arrow-dashed\" data-shape=\"line-arrow-dashed\" data-i18n-tooltip=\"collaborative.shape_line_arrow_dashed\" data-i18n-aria=\"collaborative.shape_line_arrow_dashed\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><line x1=\"4\" y1=\"20\" x2=\"30\" y2=\"20\" stroke=\"#000000\" stroke-width=\"2.5\" stroke-dasharray=\"5 3\"/><polygon points=\"28,15 36,20 28,25\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "line-arrow-dotted",
        "nameKey": "collaborative.shape_line_arrow_dotted",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-line-arrow-dotted\" data-shape=\"line-arrow-dotted\" data-i18n-tooltip=\"collaborative.shape_line_arrow_dotted\" data-i18n-aria=\"collaborative.shape_line_arrow_dotted\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><line x1=\"4\" y1=\"20\" x2=\"30\" y2=\"20\" stroke=\"#000000\" stroke-width=\"2.5\" stroke-dasharray=\"1 3.5\" stroke-linecap=\"round\"/><polygon points=\"28,15 36,20 28,25\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "line-double-arrow-solid",
        "nameKey": "collaborative.shape_line_double_arrow_solid",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-line-double-arrow-solid\" data-shape=\"line-double-arrow-solid\" data-i18n-tooltip=\"collaborative.shape_line_double_arrow_solid\" data-i18n-aria=\"collaborative.shape_line_double_arrow_solid\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"12,15 4,20 12,25\" fill=\"#000000\"/><line x1=\"10\" y1=\"20\" x2=\"30\" y2=\"20\" stroke=\"#000000\" stroke-width=\"2.5\"/><polygon points=\"28,15 36,20 28,25\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "line-double-arrow-dashed",
        "nameKey": "collaborative.shape_line_double_arrow_dashed",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-line-double-arrow-dashed\" data-shape=\"line-double-arrow-dashed\" data-i18n-tooltip=\"collaborative.shape_line_double_arrow_dashed\" data-i18n-aria=\"collaborative.shape_line_double_arrow_dashed\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"12,15 4,20 12,25\" fill=\"#000000\"/><line x1=\"10\" y1=\"20\" x2=\"30\" y2=\"20\" stroke=\"#000000\" stroke-width=\"2.5\" stroke-dasharray=\"4 2.5\"/><polygon points=\"28,15 36,20 28,25\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "line-double-arrow-dotted",
        "nameKey": "collaborative.shape_line_double_arrow_dotted",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-line-double-arrow-dotted\" data-shape=\"line-double-arrow-dotted\" data-i18n-tooltip=\"collaborative.shape_line_double_arrow_dotted\" data-i18n-aria=\"collaborative.shape_line_double_arrow_dotted\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"12,15 4,20 12,25\" fill=\"#000000\"/><line x1=\"10\" y1=\"20\" x2=\"30\" y2=\"20\" stroke=\"#000000\" stroke-width=\"2.5\" stroke-dasharray=\"1 3\" stroke-linecap=\"round\"/><polygon points=\"28,15 36,20 28,25\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "line-endpoint-square-solid",
        "nameKey": "collaborative.shape_line_endpoint_square_solid",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-line-endpoint-square-solid\" data-shape=\"line-endpoint-square-solid\" data-i18n-tooltip=\"collaborative.shape_line_endpoint_square_solid\" data-i18n-aria=\"collaborative.shape_line_endpoint_square_solid\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><rect x=\"3\" y=\"17\" width=\"6\" height=\"6\" fill=\"#000000\"/><line x1=\"9\" y1=\"20\" x2=\"31\" y2=\"20\" stroke=\"#000000\" stroke-width=\"2.5\"/><rect x=\"31\" y=\"17\" width=\"6\" height=\"6\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "line-endpoint-circle-solid",
        "nameKey": "collaborative.shape_line_endpoint_circle_solid",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-line-endpoint-circle-solid\" data-shape=\"line-endpoint-circle-solid\" data-i18n-tooltip=\"collaborative.shape_line_endpoint_circle_solid\" data-i18n-aria=\"collaborative.shape_line_endpoint_circle_solid\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><circle cx=\"6\" cy=\"20\" r=\"3.5\" fill=\"#000000\"/><line x1=\"9.5\" y1=\"20\" x2=\"30.5\" y2=\"20\" stroke=\"#000000\" stroke-width=\"2.5\"/><circle cx=\"34\" cy=\"20\" r=\"3.5\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "line-endpoint-diamond-solid",
        "nameKey": "collaborative.shape_line_endpoint_diamond_solid",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-line-endpoint-diamond-solid\" data-shape=\"line-endpoint-diamond-solid\" data-i18n-tooltip=\"collaborative.shape_line_endpoint_diamond_solid\" data-i18n-aria=\"collaborative.shape_line_endpoint_diamond_solid\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"6,16 10,20 6,24 2,20\" fill=\"#000000\"/><line x1=\"10\" y1=\"20\" x2=\"30\" y2=\"20\" stroke=\"#000000\" stroke-width=\"2.5\"/><polygon points=\"34,16 38,20 34,24 30,20\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "line-endpoint-square-hollow",
        "nameKey": "collaborative.shape_line_endpoint_square_hollow",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-line-endpoint-square-hollow\" data-shape=\"line-endpoint-square-hollow\" data-i18n-tooltip=\"collaborative.shape_line_endpoint_square_hollow\" data-i18n-aria=\"collaborative.shape_line_endpoint_square_hollow\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><rect x=\"3\" y=\"17\" width=\"6\" height=\"6\" fill=\"#ffffff\" stroke=\"#000000\" stroke-width=\"1.8\"/><line x1=\"9\" y1=\"20\" x2=\"31\" y2=\"20\" stroke=\"#000000\" stroke-width=\"2.5\"/><rect x=\"31\" y=\"17\" width=\"6\" height=\"6\" fill=\"#ffffff\" stroke=\"#000000\" stroke-width=\"1.8\"/></svg> </button>"
      },
      {
        "shape": "line-endpoint-circle-hollow",
        "nameKey": "collaborative.shape_line_endpoint_circle_hollow",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-line-endpoint-circle-hollow\" data-shape=\"line-endpoint-circle-hollow\" data-i18n-tooltip=\"collaborative.shape_line_endpoint_circle_hollow\" data-i18n-aria=\"collaborative.shape_line_endpoint_circle_hollow\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><circle cx=\"6\" cy=\"20\" r=\"3.5\" fill=\"#ffffff\" stroke=\"#000000\" stroke-width=\"1.8\"/><line x1=\"9.5\" y1=\"20\" x2=\"30.5\" y2=\"20\" stroke=\"#000000\" stroke-width=\"2.5\"/><circle cx=\"34\" cy=\"20\" r=\"3.5\" fill=\"#ffffff\" stroke=\"#000000\" stroke-width=\"1.8\"/></svg> </button>"
      },
      {
        "shape": "line-endpoint-diamond-hollow",
        "nameKey": "collaborative.shape_line_endpoint_diamond_hollow",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-line-endpoint-diamond-hollow\" data-shape=\"line-endpoint-diamond-hollow\" data-i18n-tooltip=\"collaborative.shape_line_endpoint_diamond_hollow\" data-i18n-aria=\"collaborative.shape_line_endpoint_diamond_hollow\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"6,16 10,20 6,24 2,20\" fill=\"#ffffff\" stroke=\"#000000\" stroke-width=\"1.8\"/><line x1=\"10\" y1=\"20\" x2=\"30\" y2=\"20\" stroke=\"#000000\" stroke-width=\"2.5\"/><polygon points=\"34,16 38,20 34,24 30,20\" fill=\"#ffffff\" stroke=\"#000000\" stroke-width=\"1.8\"/></svg> </button>"
      }
    ]
  },
  "basic": {
    "id": "basic",
    "titleKey": "collaborative.shape_cat_basic",
    "shapes": [
      {
        "shape": "rect",
        "nameKey": "collaborative.shape_rect",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-rect\" data-shape=\"rect\" data-i18n-tooltip=\"collaborative.shape_rect\" data-i18n-aria=\"collaborative.shape_rect\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><rect x=\"3\" y=\"3\" width=\"34\" height=\"34\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "rounded-rect",
        "nameKey": "collaborative.shape_rounded_rect",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-rounded-rect\" data-shape=\"rounded-rect\" data-i18n-tooltip=\"collaborative.shape_rounded_rect\" data-i18n-aria=\"collaborative.shape_rounded_rect\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><rect x=\"3\" y=\"3\" width=\"34\" height=\"34\" rx=\"8\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "circle",
        "nameKey": "collaborative.shape_circle",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-circle\" data-shape=\"circle\" data-i18n-tooltip=\"collaborative.shape_circle\" data-i18n-aria=\"collaborative.shape_circle\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><circle cx=\"20\" cy=\"20\" r=\"17\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "triangle",
        "nameKey": "collaborative.shape_triangle",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-triangle\" data-shape=\"triangle\" data-i18n-tooltip=\"collaborative.shape_triangle\" data-i18n-aria=\"collaborative.shape_triangle\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20,3 37,37 3,37\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "triangle-down",
        "nameKey": "collaborative.shape_triangle_down",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-triangle-down\" data-shape=\"triangle-down\" data-i18n-tooltip=\"collaborative.shape_triangle_down\" data-i18n-aria=\"collaborative.shape_triangle_down\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"3,3 37,3 20,37\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "diamond",
        "nameKey": "collaborative.shape_diamond",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-diamond\" data-shape=\"diamond\" data-i18n-tooltip=\"collaborative.shape_diamond\" data-i18n-aria=\"collaborative.shape_diamond\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20,3 37,20 20,37 3,20\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "cross",
        "nameKey": "collaborative.shape_cross",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-cross\" data-shape=\"cross\" data-i18n-tooltip=\"collaborative.shape_cross\" data-i18n-aria=\"collaborative.shape_cross\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"14,3 26,3 26,14 37,14 37,26 26,26 26,37 14,37 14,26 3,26 3,14 14,14\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "plaque",
        "nameKey": "collaborative.shape_plaque",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-plaque\" data-shape=\"plaque\" data-i18n-tooltip=\"collaborative.shape_plaque\" data-i18n-aria=\"collaborative.shape_plaque\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 3 8 Q 20 3 37 8 V 32 Q 20 37 3 32 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "scalloped-rect",
        "nameKey": "collaborative.shape_scalloped_rect",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-scalloped-rect\" data-shape=\"scalloped-rect\" data-i18n-tooltip=\"collaborative.shape_scalloped_rect\" data-i18n-aria=\"collaborative.shape_scalloped_rect\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 9 3 H 31 A 6 6 0 0 0 37 9 V 31 A 6 6 0 0 0 31 37 H 9 A 6 6 0 0 0 3 31 V 9 A 6 6 0 0 0 9 3 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "parallelogram-right",
        "nameKey": "collaborative.shape_parallelogram_right",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-parallelogram-right\" data-shape=\"parallelogram-right\" data-i18n-tooltip=\"collaborative.shape_parallelogram_right\" data-i18n-aria=\"collaborative.shape_parallelogram_right\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"11,5 37,5 29,35 3,35\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "parallelogram-left",
        "nameKey": "collaborative.shape_parallelogram_left",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-parallelogram-left\" data-shape=\"parallelogram-left\" data-i18n-tooltip=\"collaborative.shape_parallelogram_left\" data-i18n-aria=\"collaborative.shape_parallelogram_left\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"3,5 29,5 37,35 11,35\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "trapezoid",
        "nameKey": "collaborative.shape_trapezoid",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-trapezoid\" data-shape=\"trapezoid\" data-i18n-tooltip=\"collaborative.shape_trapezoid\" data-i18n-aria=\"collaborative.shape_trapezoid\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"9,5 31,5 37,35 3,35\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "trapezoid-inverted",
        "nameKey": "collaborative.shape_trapezoid_inverted",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-trapezoid-inverted\" data-shape=\"trapezoid-inverted\" data-i18n-tooltip=\"collaborative.shape_trapezoid_inverted\" data-i18n-aria=\"collaborative.shape_trapezoid_inverted\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"3,5 37,5 31,35 9,35\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "shield",
        "nameKey": "collaborative.shape_shield",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-shield\" data-shape=\"shield\" data-i18n-tooltip=\"collaborative.shape_shield\" data-i18n-aria=\"collaborative.shape_shield\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 4 3 H 36 V 22 C 36 34 20 38 20 38 C 20 38 4 34 4 22 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "arch",
        "nameKey": "collaborative.shape_arch",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-arch\" data-shape=\"arch\" data-i18n-tooltip=\"collaborative.shape_arch\" data-i18n-aria=\"collaborative.shape_arch\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 5 37 V 18 C 5 8 35 8 35 18 V 37 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "right-triangle",
        "nameKey": "collaborative.shape_right_triangle",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-right-triangle\" data-shape=\"right-triangle\" data-i18n-tooltip=\"collaborative.shape_right_triangle\" data-i18n-aria=\"collaborative.shape_right_triangle\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"3,3 3,37 37,37\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "semicircle",
        "nameKey": "collaborative.shape_semicircle",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-semicircle\" data-shape=\"semicircle\" data-i18n-tooltip=\"collaborative.shape_semicircle\" data-i18n-aria=\"collaborative.shape_semicircle\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 3 33 A 17 17 0 0 1 37 33 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "quarter-circle",
        "nameKey": "collaborative.shape_quarter_circle",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-quarter-circle\" data-shape=\"quarter-circle\" data-i18n-tooltip=\"collaborative.shape_quarter_circle\" data-i18n-aria=\"collaborative.shape_quarter_circle\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 3 37 V 3 A 34 34 0 0 1 37 37 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "quarter-circle-arc",
        "nameKey": "collaborative.shape_quarter_circle_arc",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-quarter-circle-arc\" data-shape=\"quarter-circle-arc\" data-i18n-tooltip=\"collaborative.shape_quarter_circle_arc\" data-i18n-aria=\"collaborative.shape_quarter_circle_arc\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 3 37 H 17 A 20 20 0 0 1 37 17 V 3 A 34 34 0 0 0 3 37 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "semicircle-arc",
        "nameKey": "collaborative.shape_semicircle_arc",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-semicircle-arc\" data-shape=\"semicircle-arc\" data-i18n-tooltip=\"collaborative.shape_semicircle_arc\" data-i18n-aria=\"collaborative.shape_semicircle_arc\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 3 33 H 15 A 5 5 0 0 1 25 33 H 37 A 17 17 0 0 0 3 33 Z\" fill=\"#000000\"/></svg> </button>"
      }
    ]
  },
  "polygons": {
    "id": "polygons",
    "titleKey": "collaborative.shape_cat_polygons",
    "shapes": [
      {
        "shape": "pentagon",
        "nameKey": "collaborative.shape_pentagon",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-pentagon\" data-shape=\"pentagon\" data-i18n-tooltip=\"collaborative.shape_pentagon\" data-i18n-aria=\"collaborative.shape_pentagon\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20.0,3.0 36.2,14.7 30.0,33.8 10.0,33.8 3.8,14.7\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "hexagon-vertical",
        "nameKey": "collaborative.shape_hexagon_vertical",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-hexagon-vertical\" data-shape=\"hexagon-vertical\" data-i18n-tooltip=\"collaborative.shape_hexagon_vertical\" data-i18n-aria=\"collaborative.shape_hexagon_vertical\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20,3 36,11.5 36,28.5 20,37 4,28.5 4,11.5\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "hexagon",
        "nameKey": "collaborative.shape_hexagon",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-hexagon\" data-shape=\"hexagon\" data-i18n-tooltip=\"collaborative.shape_hexagon\" data-i18n-aria=\"collaborative.shape_hexagon\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"11.5,4 28.5,4 37,20 28.5,36 11.5,36 3,20\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "octagon",
        "nameKey": "collaborative.shape_octagon",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-octagon\" data-shape=\"octagon\" data-i18n-tooltip=\"collaborative.shape_octagon\" data-i18n-aria=\"collaborative.shape_octagon\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20.0,3.0 32.0,8.0 37.0,20.0 32.0,32.0 20.0,37.0 8.0,32.0 3.0,20.0 8.0,8.0\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "chamfered-rect",
        "nameKey": "collaborative.shape_chamfered_rect",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-chamfered-rect\" data-shape=\"chamfered-rect\" data-i18n-tooltip=\"collaborative.shape_chamfered_rect\" data-i18n-aria=\"collaborative.shape_chamfered_rect\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"8,3 32,3 37,8 37,32 32,37 8,37 3,32 3,8\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "heptagon",
        "nameKey": "collaborative.shape_heptagon",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-heptagon\" data-shape=\"heptagon\" data-i18n-tooltip=\"collaborative.shape_heptagon\" data-i18n-aria=\"collaborative.shape_heptagon\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20.0,3.0 33.3,9.4 36.6,23.8 27.4,35.3 12.6,35.3 3.4,23.8 6.7,9.4\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "decagon",
        "nameKey": "collaborative.shape_decagon",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-decagon\" data-shape=\"decagon\" data-i18n-tooltip=\"collaborative.shape_decagon\" data-i18n-aria=\"collaborative.shape_decagon\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20.0,3.0 30.0,6.2 36.2,14.7 36.2,25.3 30.0,33.8 20.0,37.0 10.0,33.8 3.8,25.3 3.8,14.7 10.0,6.2\" fill=\"#000000\"/></svg> </button>"
      }
    ]
  },
  "stars": {
    "id": "stars",
    "titleKey": "collaborative.shape_cat_stars",
    "shapes": [
      {
        "shape": "star-4",
        "nameKey": "collaborative.shape_star_4",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-star-4\" data-shape=\"star-4\" data-i18n-tooltip=\"collaborative.shape_star_4\" data-i18n-aria=\"collaborative.shape_star_4\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20.0,2.0 23.8,16.2 38.0,20.0 23.8,23.8 20.0,38.0 16.2,23.8 2.0,20.0 16.2,16.2\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "star-5",
        "nameKey": "collaborative.shape_star_5",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-star-5\" data-shape=\"star-5\" data-i18n-tooltip=\"collaborative.shape_star_5\" data-i18n-aria=\"collaborative.shape_star_5\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20.0,2.0 24.4,13.9 37.1,14.4 27.2,22.3 30.6,34.6 20.0,27.6 9.4,34.6 12.8,22.3 2.9,14.4 15.6,13.9\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "star-6",
        "nameKey": "collaborative.shape_star_6",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-star-6\" data-shape=\"star-6\" data-i18n-tooltip=\"collaborative.shape_star_6\" data-i18n-aria=\"collaborative.shape_star_6\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20.0,2.0 25.2,11.0 35.6,11.0 30.4,20.0 35.6,29.0 25.2,29.0 20.0,38.0 14.8,29.0 4.4,29.0 9.6,20.0 4.4,11.0 14.8,11.0\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "star-8",
        "nameKey": "collaborative.shape_star_8",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-star-8\" data-shape=\"star-8\" data-i18n-tooltip=\"collaborative.shape_star_8\" data-i18n-aria=\"collaborative.shape_star_8\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20.0,2.0 24.5,9.2 32.7,7.3 30.8,15.5 38.0,20.0 30.8,24.5 32.7,32.7 24.5,30.8 20.0,38.0 15.5,30.8 7.3,32.7 9.2,24.5 2.0,20.0 9.2,15.5 7.3,7.3 15.5,9.2\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "star-8-soft",
        "nameKey": "collaborative.shape_star_8_soft",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-star-8-soft\" data-shape=\"star-8-soft\" data-i18n-tooltip=\"collaborative.shape_star_8_soft\" data-i18n-aria=\"collaborative.shape_star_8_soft\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20.0,2.0 25.4,7.0 32.7,7.3 33.0,14.6 38.0,20.0 33.0,25.4 32.7,32.7 25.4,33.0 20.0,38.0 14.6,33.0 7.3,32.7 7.0,25.4 2.0,20.0 7.0,14.6 7.3,7.3 14.6,7.0\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "star-12",
        "nameKey": "collaborative.shape_star_12",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-star-12\" data-shape=\"star-12\" data-i18n-tooltip=\"collaborative.shape_star_12\" data-i18n-aria=\"collaborative.shape_star_12\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20.0,2.0 23.7,6.1 29.0,4.4 30.2,9.8 35.6,11.0 33.9,16.3 38.0,20.0 33.9,23.7 35.6,29.0 30.2,30.2 29.0,35.6 23.7,33.9 20.0,38.0 16.3,33.9 11.0,35.6 9.8,30.2 4.4,29.0 6.1,23.7 2.0,20.0 6.1,16.3 4.4,11.0 9.8,9.8 11.0,4.4 16.3,6.1\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "star-16",
        "nameKey": "collaborative.shape_star_16",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-star-16\" data-shape=\"star-16\" data-i18n-tooltip=\"collaborative.shape_star_16\" data-i18n-aria=\"collaborative.shape_star_16\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20.0,2.0 22.9,5.2 26.9,3.4 28.4,7.4 32.7,7.3 32.6,11.6 36.6,13.1 34.8,17.1 38.0,20.0 34.8,22.9 36.6,26.9 32.6,28.4 32.7,32.7 28.4,32.6 26.9,36.6 22.9,34.8 20.0,38.0 17.1,34.8 13.1,36.6 11.6,32.6 7.3,32.7 7.4,28.4 3.4,26.9 5.2,22.9 2.0,20.0 5.2,17.1 3.4,13.1 7.4,11.6 7.3,7.3 11.6,7.4 13.1,3.4 17.1,5.2\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "star-24",
        "nameKey": "collaborative.shape_star_24",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-star-24\" data-shape=\"star-24\" data-i18n-tooltip=\"collaborative.shape_star_24\" data-i18n-aria=\"collaborative.shape_star_24\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20.0,2.0 22.1,4.3 24.7,2.6 26.1,5.4 29.0,4.4 29.6,7.4 32.7,7.3 32.6,10.4 35.6,11.0 34.6,13.9 37.4,15.3 35.7,17.9 38.0,20.0 35.7,22.1 37.4,24.7 34.6,26.1 35.6,29.0 32.6,29.6 32.7,32.7 29.6,32.6 29.0,35.6 26.1,34.6 24.7,37.4 22.1,35.7 20.0,38.0 17.9,35.7 15.3,37.4 13.9,34.6 11.0,35.6 10.4,32.6 7.3,32.7 7.4,29.6 4.4,29.0 5.4,26.1 2.6,24.7 4.3,22.1 2.0,20.0 4.3,17.9 2.6,15.3 5.4,13.9 4.4,11.0 7.4,10.4 7.3,7.3 10.4,7.4 11.0,4.4 13.9,5.4 15.3,2.6 17.9,4.3\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "star-32",
        "nameKey": "collaborative.shape_star_32",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-star-32\" data-shape=\"star-32\" data-i18n-tooltip=\"collaborative.shape_star_32\" data-i18n-aria=\"collaborative.shape_star_32\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20.0,2.0 21.6,3.7 23.5,2.3 24.8,4.3 26.9,3.4 27.7,5.6 30.0,5.0 30.4,7.3 32.7,7.3 32.7,9.6 35.0,10.0 34.4,12.3 36.6,13.1 35.7,15.2 37.7,16.5 36.3,18.4 38.0,20.0 36.3,21.6 37.7,23.5 35.7,24.8 36.6,26.9 34.4,27.7 35.0,30.0 32.7,30.4 32.7,32.7 30.4,32.7 30.0,35.0 27.7,34.4 26.9,36.6 24.8,35.7 23.5,37.7 21.6,36.3 20.0,38.0 18.4,36.3 16.5,37.7 15.2,35.7 13.1,36.6 12.3,34.4 10.0,35.0 9.6,32.7 7.3,32.7 7.3,30.4 5.0,30.0 5.6,27.7 3.4,26.9 4.3,24.8 2.3,23.5 3.7,21.6 2.0,20.0 3.7,18.4 2.3,16.5 4.3,15.2 3.4,13.1 5.6,12.3 5.0,10.0 7.3,9.6 7.3,7.3 9.6,7.3 10.0,5.0 12.3,5.6 13.1,3.4 15.2,4.3 16.5,2.3 18.4,3.7\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "star-7",
        "nameKey": "collaborative.shape_star_7",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-star-7\" data-shape=\"star-7\" data-i18n-tooltip=\"collaborative.shape_star_7\" data-i18n-aria=\"collaborative.shape_star_7\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20.0,2.0 24.1,11.6 34.1,8.8 29.1,17.9 37.5,24.0 27.3,25.8 27.8,36.2 20.0,29.4 12.2,36.2 12.7,25.8 2.5,24.0 10.9,17.9 5.9,8.8 15.9,11.6\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "flare-8",
        "nameKey": "collaborative.shape_flare_8",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-flare-8\" data-shape=\"flare-8\" data-i18n-tooltip=\"collaborative.shape_flare_8\" data-i18n-aria=\"collaborative.shape_flare_8\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20,2 21,17 32,7 22,19 38,20 22,21 32,33 21,23 20,38 19,23 8,33 18,21 2,20 18,19 8,7 19,17\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "flare-12",
        "nameKey": "collaborative.shape_flare_12",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-flare-12\" data-shape=\"flare-12\" data-i18n-tooltip=\"collaborative.shape_flare_12\" data-i18n-aria=\"collaborative.shape_flare_12\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20.0,2.0 21.0,16.2 29.0,4.4 22.8,17.2 35.6,11.0 23.8,19.0 38.0,20.0 23.8,21.0 35.6,29.0 22.8,22.8 29.0,35.6 21.0,23.8 20.0,38.0 19.0,23.8 11.0,35.6 17.2,22.8 4.4,29.0 16.2,21.0 2.0,20.0 16.2,19.0 4.4,11.0 17.2,17.2 11.0,4.4 19.0,16.2\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "flare-16",
        "nameKey": "collaborative.shape_flare_16",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-flare-16\" data-shape=\"flare-16\" data-i18n-tooltip=\"collaborative.shape_flare_16\" data-i18n-aria=\"collaborative.shape_flare_16\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20.0,2.0 20.9,15.6 26.9,3.4 22.5,16.3 32.7,7.3 23.7,17.5 36.6,13.1 24.4,19.1 38.0,20.0 24.4,20.9 36.6,26.9 23.7,22.5 32.7,32.7 22.5,23.7 26.9,36.6 20.9,24.4 20.0,38.0 19.1,24.4 13.1,36.6 17.5,23.7 7.3,32.7 16.3,22.5 3.4,26.9 15.6,20.9 2.0,20.0 15.6,19.1 3.4,13.1 16.3,17.5 7.3,7.3 17.5,16.3 13.1,3.4 19.1,15.6\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "badge-scallop",
        "nameKey": "collaborative.shape_badge_scallop",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-badge-scallop\" data-shape=\"badge-scallop\" data-i18n-tooltip=\"collaborative.shape_badge_scallop\" data-i18n-aria=\"collaborative.shape_badge_scallop\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 34.8 20.0 C 38.8 21.5, 37.7 23.1, 37.7 23.1 C 37.7 23.1, 38.2 25.1, 33.9 25.0 C 37.2 27.8, 35.6 29.0, 35.6 29.0 C 35.6 29.0, 35.4 31.0, 31.3 29.5 C 33.5 33.2, 31.6 33.8, 31.6 33.8 C 31.6 33.8, 30.7 35.6, 27.4 32.8 C 28.1 37.1, 26.2 36.9, 26.2 36.9 C 26.2 36.9, 24.7 38.3, 22.6 34.5 C 21.8 38.8, 20.0 38.0, 20.0 38.0 C 20.0 38.0, 18.2 38.8, 17.4 34.5 C 15.3 38.3, 13.8 36.9, 13.8 36.9 C 13.8 36.9, 11.9 37.1, 12.6 32.8 C 9.3 35.6, 8.4 33.8, 8.4 33.8 C 8.4 33.8, 6.5 33.2, 8.7 29.5 C 4.6 31.0, 4.4 29.0, 4.4 29.0 C 4.4 29.0, 2.8 27.8, 6.1 25.0 C 1.8 25.1, 2.3 23.1, 2.3 23.1 C 2.3 23.1, 1.2 21.5, 5.2 20.0 C 1.2 18.5, 2.3 16.9, 2.3 16.9 C 2.3 16.9, 1.8 14.9, 6.1 15.0 C 2.8 12.2, 4.4 11.0, 4.4 11.0 C 4.4 11.0, 4.6 9.0, 8.7 10.5 C 6.5 6.8, 8.4 6.2, 8.4 6.2 C 8.4 6.2, 9.3 4.4, 12.6 7.2 C 11.9 2.9, 13.8 3.1, 13.8 3.1 C 13.8 3.1, 15.3 1.7, 17.4 5.5 C 18.2 1.2, 20.0 2.0, 20.0 2.0 C 20.0 2.0, 21.8 1.2, 22.6 5.5 C 24.7 1.7, 26.2 3.1, 26.2 3.1 C 26.2 3.1, 28.1 2.9, 27.4 7.2 C 30.7 4.4, 31.6 6.2, 31.6 6.2 C 31.6 6.2, 33.5 6.8, 31.3 10.5 C 35.4 9.0, 35.6 11.0, 35.6 11.0 C 35.6 11.0, 37.2 12.2, 33.9 15.0 C 38.2 14.9, 37.7 16.9, 37.7 16.9 C 37.7 16.9, 38.8 18.5, 34.8 20.0 Z\" fill=\"#000000\"/></svg> </button>"
      }
    ]
  },
  "arrows": {
    "id": "arrows",
    "titleKey": "collaborative.shape_cat_arrows",
    "shapes": [
      {
        "shape": "arrow-block-right",
        "nameKey": "collaborative.shape_arrow_block_right",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-arrow-block-right\" data-shape=\"arrow-block-right\" data-i18n-tooltip=\"collaborative.shape_arrow_block_right\" data-i18n-aria=\"collaborative.shape_arrow_block_right\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"2,13 22,13 22,3 38,20 22,37 22,27 2,27\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "arrow-block-left",
        "nameKey": "collaborative.shape_arrow_block_left",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-arrow-block-left\" data-shape=\"arrow-block-left\" data-i18n-tooltip=\"collaborative.shape_arrow_block_left\" data-i18n-aria=\"collaborative.shape_arrow_block_left\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"38,13 18,13 18,3 2,20 18,37 18,27 38,27\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "arrow-block-up",
        "nameKey": "collaborative.shape_arrow_block_up",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-arrow-block-up\" data-shape=\"arrow-block-up\" data-i18n-tooltip=\"collaborative.shape_arrow_block_up\" data-i18n-aria=\"collaborative.shape_arrow_block_up\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"13,38 13,18 3,18 20,2 37,18 27,18 27,38\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "arrow-block-down",
        "nameKey": "collaborative.shape_arrow_block_down",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-arrow-block-down\" data-shape=\"arrow-block-down\" data-i18n-tooltip=\"collaborative.shape_arrow_block_down\" data-i18n-aria=\"collaborative.shape_arrow_block_down\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"13,2 13,22 3,22 20,38 37,22 27,22 27,2\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "arrow-double-horizontal",
        "nameKey": "collaborative.shape_arrow_double_horizontal",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-arrow-double-horizontal\" data-shape=\"arrow-double-horizontal\" data-i18n-tooltip=\"collaborative.shape_arrow_double_horizontal\" data-i18n-aria=\"collaborative.shape_arrow_double_horizontal\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"10,3 2,20 10,37 10,27 30,27 30,37 38,20 30,3 30,13 10,13\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "arrow-double-vertical",
        "nameKey": "collaborative.shape_arrow_double_vertical",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-arrow-double-vertical\" data-shape=\"arrow-double-vertical\" data-i18n-tooltip=\"collaborative.shape_arrow_double_vertical\" data-i18n-aria=\"collaborative.shape_arrow_double_vertical\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"3,10 20,2 37,10 27,10 27,30 37,30 20,38 3,30 13,30 13,10\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "arrow-pentagon-right",
        "nameKey": "collaborative.shape_arrow_pentagon_right",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-arrow-pentagon-right\" data-shape=\"arrow-pentagon-right\" data-i18n-tooltip=\"collaborative.shape_arrow_pentagon_right\" data-i18n-aria=\"collaborative.shape_arrow_pentagon_right\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"2,5 26,5 38,20 26,35 2,35\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "arrow-chevron-right",
        "nameKey": "collaborative.shape_arrow_chevron_right",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-arrow-chevron-right\" data-shape=\"arrow-chevron-right\" data-i18n-tooltip=\"collaborative.shape_arrow_chevron_right\" data-i18n-aria=\"collaborative.shape_arrow_chevron_right\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"2,5 26,5 38,20 26,35 2,35 14,20\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "arrow-notched-left",
        "nameKey": "collaborative.shape_arrow_notched_left",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-arrow-notched-left\" data-shape=\"arrow-notched-left\" data-i18n-tooltip=\"collaborative.shape_arrow_notched_left\" data-i18n-aria=\"collaborative.shape_arrow_notched_left\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"38,5 16,5 16,11 2,20 16,29 16,35 38,35 28,20\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "arrow-bidirectional-bold",
        "nameKey": "collaborative.shape_arrow_bidirectional_bold",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-arrow-bidirectional-bold\" data-shape=\"arrow-bidirectional-bold\" data-i18n-tooltip=\"collaborative.shape_arrow_bidirectional_bold\" data-i18n-aria=\"collaborative.shape_arrow_bidirectional_bold\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"11,6 2,20 11,34 11,26 29,26 29,34 38,20 29,6 29,14 11,14\" fill=\"#000000\"/></svg> </button>"
      }
    ]
  },
  "flowchart": {
    "id": "flowchart",
    "titleKey": "collaborative.shape_cat_flowchart",
    "shapes": [
      {
        "shape": "flowchart-preparation",
        "nameKey": "collaborative.shape_flowchart_preparation",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-flowchart-preparation\" data-shape=\"flowchart-preparation\" data-i18n-tooltip=\"collaborative.shape_flowchart_preparation\" data-i18n-aria=\"collaborative.shape_flowchart_preparation\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"9,4 31,4 38,20 31,36 9,36 2,20\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "flowchart-terminator",
        "nameKey": "collaborative.shape_flowchart_terminator",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-flowchart-terminator\" data-shape=\"flowchart-terminator\" data-i18n-tooltip=\"collaborative.shape_flowchart_terminator\" data-i18n-aria=\"collaborative.shape_flowchart_terminator\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><rect x=\"2\" y=\"7\" width=\"36\" height=\"26\" rx=\"13\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "flowchart-process-rounded",
        "nameKey": "collaborative.shape_flowchart_process_rounded",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-flowchart-process-rounded\" data-shape=\"flowchart-process-rounded\" data-i18n-tooltip=\"collaborative.shape_flowchart_process_rounded\" data-i18n-aria=\"collaborative.shape_flowchart_process_rounded\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><rect x=\"2\" y=\"6\" width=\"36\" height=\"28\" rx=\"6\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "flowchart-decision",
        "nameKey": "collaborative.shape_flowchart_decision",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-flowchart-decision\" data-shape=\"flowchart-decision\" data-i18n-tooltip=\"collaborative.shape_flowchart_decision\" data-i18n-aria=\"collaborative.shape_flowchart_decision\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20,2 38,20 20,38 2,20\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "flowchart-document",
        "nameKey": "collaborative.shape_flowchart_document",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-flowchart-document\" data-shape=\"flowchart-document\" data-i18n-tooltip=\"collaborative.shape_flowchart_document\" data-i18n-aria=\"collaborative.shape_flowchart_document\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 2 4 H 38 V 28 C 30 34 26 24 18 30 C 12 34 6 30 2 32 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "flowchart-data",
        "nameKey": "collaborative.shape_flowchart_data",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-flowchart-data\" data-shape=\"flowchart-data\" data-i18n-tooltip=\"collaborative.shape_flowchart_data\" data-i18n-aria=\"collaborative.shape_flowchart_data\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"9,4 38,4 31,36 2,36\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "flowchart-manual",
        "nameKey": "collaborative.shape_flowchart_manual",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-flowchart-manual\" data-shape=\"flowchart-manual\" data-i18n-tooltip=\"collaborative.shape_flowchart_manual\" data-i18n-aria=\"collaborative.shape_flowchart_manual\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"2,4 38,4 32,36 8,36\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "flowchart-delay",
        "nameKey": "collaborative.shape_flowchart_delay",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-flowchart-delay\" data-shape=\"flowchart-delay\" data-i18n-tooltip=\"collaborative.shape_flowchart_delay\" data-i18n-aria=\"collaborative.shape_flowchart_delay\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 2 4 H 22 A 16 16 0 0 1 22 36 H 2 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "flowchart-merge",
        "nameKey": "collaborative.shape_flowchart_merge",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-flowchart-merge\" data-shape=\"flowchart-merge\" data-i18n-tooltip=\"collaborative.shape_flowchart_merge\" data-i18n-aria=\"collaborative.shape_flowchart_merge\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"2,4 38,4 20,36\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "flowchart-display",
        "nameKey": "collaborative.shape_flowchart_display",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-flowchart-display\" data-shape=\"flowchart-display\" data-i18n-tooltip=\"collaborative.shape_flowchart_display\" data-i18n-aria=\"collaborative.shape_flowchart_display\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 11 4 H 38 V 36 H 11 L 2 20 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "flowchart-offpage",
        "nameKey": "collaborative.shape_flowchart_offpage",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-flowchart-offpage\" data-shape=\"flowchart-offpage\" data-i18n-tooltip=\"collaborative.shape_flowchart_offpage\" data-i18n-aria=\"collaborative.shape_flowchart_offpage\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"4,2 36,2 36,24 20,38 4,24\" fill=\"#000000\"/></svg> </button>"
      }
    ]
  },
  "callouts": {
    "id": "callouts",
    "titleKey": "collaborative.shape_cat_callouts",
    "shapes": [
      {
        "shape": "callout-rect",
        "nameKey": "collaborative.shape_callout_rect",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-callout-rect\" data-shape=\"callout-rect\" data-i18n-tooltip=\"collaborative.shape_callout_rect\" data-i18n-aria=\"collaborative.shape_callout_rect\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 3 5 H 37 V 27 H 14 L 6 35 L 8 27 H 3 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "callout-oval",
        "nameKey": "collaborative.shape_callout_oval",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-callout-oval\" data-shape=\"callout-oval\" data-i18n-tooltip=\"collaborative.shape_callout_oval\" data-i18n-aria=\"collaborative.shape_callout_oval\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 20 4 C 30 4 38 10 38 18 C 38 25 30 31 20 31 C 16 31 12 30 9 28 L 3 35 L 5 27 C 3 24 2 21 2 18 C 2 10 10 4 20 4 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "callout-thought",
        "nameKey": "collaborative.shape_callout_thought",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-callout-thought\" data-shape=\"callout-thought\" data-i18n-tooltip=\"collaborative.shape_callout_thought\" data-i18n-aria=\"collaborative.shape_callout_thought\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 12 8 A 6 6 0 0 1 23 5 A 7 7 0 0 1 33 10 A 6 6 0 0 1 37 17 A 6 6 0 0 1 33 25 A 7 7 0 0 1 21 28 A 6 6 0 0 1 11 25 A 6 6 0 0 1 6 17 A 6 6 0 0 1 12 8 Z M 7 31 A 2 2 0 1 1 7 31.1 M 4 35 A 1.3 1.3 0 1 1 4 35.1\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "callout-rounded",
        "nameKey": "collaborative.shape_callout_rounded",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-callout-rounded\" data-shape=\"callout-rounded\" data-i18n-tooltip=\"collaborative.shape_callout_rounded\" data-i18n-aria=\"collaborative.shape_callout_rounded\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 7 4 H 33 A 4 4 0 0 1 37 8 V 23 A 4 4 0 0 1 33 27 H 14 L 6 35 L 8 27 H 7 A 4 4 0 0 1 3 23 V 8 A 4 4 0 0 1 7 4 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "callout-capsule",
        "nameKey": "collaborative.shape_callout_capsule",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-callout-capsule\" data-shape=\"callout-capsule\" data-i18n-tooltip=\"collaborative.shape_callout_capsule\" data-i18n-aria=\"collaborative.shape_callout_capsule\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 16 4 H 24 A 13 13 0 0 1 37 17 A 13 13 0 0 1 24 30 H 16 L 8 36 L 10 29 C 5 27 3 22 3 17 A 13 13 0 0 1 16 4 Z\" fill=\"#000000\"/></svg> </button>"
      }
    ]
  },
  "clouds": {
    "id": "clouds",
    "titleKey": "collaborative.shape_cat_clouds",
    "shapes": [
      {
        "shape": "cloud-puffy",
        "nameKey": "collaborative.shape_cloud_puffy",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-cloud-puffy\" data-shape=\"cloud-puffy\" data-i18n-tooltip=\"collaborative.shape_cloud_puffy\" data-i18n-aria=\"collaborative.shape_cloud_puffy\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 10 30 C 5 30 2 26 2 21 C 2 16 6 13 11 13 C 12 8 17 5 22 5 C 27 5 31 8 32 13 C 36 13 38 16 38 20 C 38 25 35 30 30 30 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "cloud-layered",
        "nameKey": "collaborative.shape_cloud_layered",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-cloud-layered\" data-shape=\"cloud-layered\" data-i18n-tooltip=\"collaborative.shape_cloud_layered\" data-i18n-aria=\"collaborative.shape_cloud_layered\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 4 30 C 2 27 3 23 7 21 C 6 17 9 14 13 14 C 15 10 19 8 24 9 C 28 9 32 12 33 16 C 36 17 38 20 37 24 C 38 27 36 30 33 30 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "cloud-wide",
        "nameKey": "collaborative.shape_cloud_wide",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-cloud-wide\" data-shape=\"cloud-wide\" data-i18n-tooltip=\"collaborative.shape_cloud_wide\" data-i18n-aria=\"collaborative.shape_cloud_wide\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 3 28 H 37 C 38 24 37 20 34 18 C 34 13 30 10 25 11 C 23 7 18 6 14 9 C 10 9 7 13 7 17 C 4 19 2 23 3 28 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "cloud-compact",
        "nameKey": "collaborative.shape_cloud_compact",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-cloud-compact\" data-shape=\"cloud-compact\" data-i18n-tooltip=\"collaborative.shape_cloud_compact\" data-i18n-aria=\"collaborative.shape_cloud_compact\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 6 27 C 3 27 2 24 2 21 C 2 17 5 15 9 15 C 10 11 14 8 19 8 C 24 8 28 11 29 15 C 33 15 36 17 36 21 C 36 24 35 27 32 27 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "cloud-high-dome",
        "nameKey": "collaborative.shape_cloud_high_dome",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-cloud-high-dome\" data-shape=\"cloud-high-dome\" data-i18n-tooltip=\"collaborative.shape_cloud_high_dome\" data-i18n-aria=\"collaborative.shape_cloud_high_dome\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 4 29 H 36 C 37 25 36 21 32 20 C 32 14 27 7 20 7 C 13 7 8 14 8 20 C 5 21 3 25 4 29 Z\" fill=\"#000000\"/></svg> </button>"
      }
    ]
  },
  "teardrops": {
    "id": "teardrops",
    "titleKey": "collaborative.shape_cat_teardrops",
    "shapes": [
      {
        "shape": "teardrop-straight",
        "nameKey": "collaborative.shape_teardrop_straight",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-teardrop-straight\" data-shape=\"teardrop-straight\" data-i18n-tooltip=\"collaborative.shape_teardrop_straight\" data-i18n-aria=\"collaborative.shape_teardrop_straight\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 20 3 C 20 3 34 18 34 26 A 14 14 0 0 1 6 26 C 6 18 20 3 20 3 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "teardrop-elongated",
        "nameKey": "collaborative.shape_teardrop_elongated",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-teardrop-elongated\" data-shape=\"teardrop-elongated\" data-i18n-tooltip=\"collaborative.shape_teardrop_elongated\" data-i18n-aria=\"collaborative.shape_teardrop_elongated\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 20 3 C 20 3 31 19 31 27 A 11 11 0 0 1 9 27 C 9 19 20 3 20 3 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "teardrop-oval",
        "nameKey": "collaborative.shape_teardrop_oval",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-teardrop-oval\" data-shape=\"teardrop-oval\" data-i18n-tooltip=\"collaborative.shape_teardrop_oval\" data-i18n-aria=\"collaborative.shape_teardrop_oval\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 20 4 C 28 4 34 14 34 25 C 34 32 28 37 20 37 C 12 37 6 32 6 25 C 6 14 12 4 20 4 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "teardrop-wide",
        "nameKey": "collaborative.shape_teardrop_wide",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-teardrop-wide\" data-shape=\"teardrop-wide\" data-i18n-tooltip=\"collaborative.shape_teardrop_wide\" data-i18n-aria=\"collaborative.shape_teardrop_wide\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 20 4 C 22 8 36 19 36 26 A 16 16 0 0 1 4 26 C 4 19 18 8 20 4 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "teardrop-curved",
        "nameKey": "collaborative.shape_teardrop_curved",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-teardrop-curved\" data-shape=\"teardrop-curved\" data-i18n-tooltip=\"collaborative.shape_teardrop_curved\" data-i18n-aria=\"collaborative.shape_teardrop_curved\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 20 2 C 24 8 20 14 26 19 C 32 23 34 28 32 32 C 30 36 24 38 19 38 C 11 38 6 32 6 25 C 6 17 14 10 20 2 Z\" fill=\"#000000\"/></svg> </button>"
      }
    ]
  },
  "hearts": {
    "id": "hearts",
    "titleKey": "collaborative.shape_cat_hearts",
    "shapes": [
      {
        "shape": "heart-classic",
        "nameKey": "collaborative.shape_heart_classic",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-heart-classic\" data-shape=\"heart-classic\" data-i18n-tooltip=\"collaborative.shape_heart_classic\" data-i18n-aria=\"collaborative.shape_heart_classic\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 20 36 C 8 26 2 18 2 11 C 2 5 7 2 12 2 C 16 2 19 5 20 7 C 21 5 24 2 28 2 C 33 2 38 5 38 11 C 38 18 32 26 20 36 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "heart-wide",
        "nameKey": "collaborative.shape_heart_wide",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-heart-wide\" data-shape=\"heart-wide\" data-i18n-tooltip=\"collaborative.shape_heart_wide\" data-i18n-aria=\"collaborative.shape_heart_wide\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 20 34 C 6 24 1 16 1 10 C 1 4 6 1 12 1 C 16 1 19 4 20 6 C 21 4 24 1 28 1 C 34 1 39 4 39 10 C 39 16 34 24 20 34 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "heart-stylized",
        "nameKey": "collaborative.shape_heart_stylized",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-heart-stylized\" data-shape=\"heart-stylized\" data-i18n-tooltip=\"collaborative.shape_heart_stylized\" data-i18n-aria=\"collaborative.shape_heart_stylized\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 20 35 C 7 24 2 17 2 11 C 2 6 6 2 11 2 C 15 2 19 4 20 7 C 21 4 25 2 29 2 C 34 2 38 6 38 11 C 38 17 33 24 20 35 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "heart-tall",
        "nameKey": "collaborative.shape_heart_tall",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-heart-tall\" data-shape=\"heart-tall\" data-i18n-tooltip=\"collaborative.shape_heart_tall\" data-i18n-aria=\"collaborative.shape_heart_tall\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 20 38 C 10 28 4 19 4 12 C 4 6 8 2 13 2 C 17 2 19 5 20 7 C 21 5 23 2 27 2 C 32 2 36 6 36 12 C 36 19 30 28 20 38 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "heart-sharp",
        "nameKey": "collaborative.shape_heart_sharp",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-heart-sharp\" data-shape=\"heart-sharp\" data-i18n-tooltip=\"collaborative.shape_heart_sharp\" data-i18n-aria=\"collaborative.shape_heart_sharp\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 20 38 C 9 27 3 17 3 10 C 3 4 8 1 13 1 C 17 1 19 4 20 8 C 21 4 23 1 27 1 C 32 1 37 4 37 10 C 37 17 31 27 20 38 Z\" fill=\"#000000\"/></svg> </button>"
      }
    ]
  },
  "gears": {
    "id": "gears",
    "titleKey": "collaborative.shape_cat_gears",
    "shapes": [
      {
        "shape": "gear-8",
        "nameKey": "collaborative.shape_gear_8",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-gear-8\" data-shape=\"gear-8\" data-i18n-tooltip=\"collaborative.shape_gear_8\" data-i18n-aria=\"collaborative.shape_gear_8\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 20.0 6.0 L 23.1 2.3 L 27.3 3.5 L 27.8 8.3 L 29.9 10.1 L 34.7 9.6 L 36.8 13.5 L 33.8 17.3 L 34.0 20.0 L 37.7 23.1 L 36.5 27.3 L 31.7 27.8 L 29.9 29.9 L 30.4 34.7 L 26.5 36.8 L 22.7 33.8 L 20.0 34.0 L 16.9 37.7 L 12.7 36.5 L 12.2 31.7 L 10.1 29.9 L 5.3 30.4 L 3.2 26.5 L 6.2 22.7 L 6.0 20.0 L 2.3 16.9 L 3.5 12.7 L 8.3 12.2 L 10.1 10.1 L 9.6 5.3 L 13.5 3.2 L 17.3 6.2 Z M 20 13.7 A 6.3 6.3 0 1 0 20 26.3 A 6.3 6.3 0 1 0 20 13.7 Z\" fill=\"#000000\" fill-rule=\"evenodd\"/></svg> </button>"
      },
      {
        "shape": "gear-12",
        "nameKey": "collaborative.shape_gear_12",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-gear-12\" data-shape=\"gear-12\" data-i18n-tooltip=\"collaborative.shape_gear_12\" data-i18n-aria=\"collaborative.shape_gear_12\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 20.0 5.6 L 22.1 2.1 L 24.9 2.7 L 25.5 6.7 L 27.2 7.5 L 30.7 5.5 L 32.9 7.5 L 31.4 11.2 L 32.5 12.8 L 36.5 12.9 L 37.5 15.6 L 34.3 18.1 L 34.4 20.0 L 37.9 22.1 L 37.3 24.9 L 33.3 25.5 L 32.5 27.2 L 34.5 30.7 L 32.5 32.9 L 28.8 31.4 L 27.2 32.5 L 27.1 36.5 L 24.4 37.5 L 21.9 34.3 L 20.0 34.4 L 17.9 37.9 L 15.1 37.3 L 14.5 33.3 L 12.8 32.5 L 9.3 34.5 L 7.1 32.5 L 8.6 28.8 L 7.5 27.2 L 3.5 27.1 L 2.5 24.4 L 5.7 21.9 L 5.6 20.0 L 2.1 17.9 L 2.7 15.1 L 6.7 14.5 L 7.5 12.8 L 5.5 9.3 L 7.5 7.1 L 11.2 8.6 L 12.8 7.5 L 12.9 3.5 L 15.6 2.5 L 18.1 5.7 Z M 20 13.7 A 6.3 6.3 0 1 0 20 26.3 A 6.3 6.3 0 1 0 20 13.7 Z\" fill=\"#000000\" fill-rule=\"evenodd\"/></svg> </button>"
      },
      {
        "shape": "gear-10-sharp",
        "nameKey": "collaborative.shape_gear_10_sharp",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-gear-10-sharp\" data-shape=\"gear-10-sharp\" data-i18n-tooltip=\"collaborative.shape_gear_10_sharp\" data-i18n-aria=\"collaborative.shape_gear_10_sharp\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 20.0 7.8 L 22.5 2.2 L 25.9 3.0 L 25.6 9.1 L 27.2 10.1 L 32.5 7.0 L 34.8 9.7 L 30.9 14.4 L 31.6 16.2 L 37.7 16.8 L 38.0 20.3 L 32.1 21.9 L 31.6 23.8 L 36.2 27.9 L 34.4 30.9 L 28.7 28.7 L 27.2 29.9 L 28.5 35.9 L 25.2 37.2 L 21.9 32.1 L 20.0 32.2 L 17.5 37.8 L 14.1 37.0 L 14.4 30.9 L 12.8 29.9 L 7.5 33.0 L 5.2 30.3 L 9.1 25.6 L 8.4 23.8 L 2.3 23.2 L 2.0 19.7 L 7.9 18.1 L 8.4 16.2 L 3.8 12.1 L 5.6 9.1 L 11.3 11.3 L 12.8 10.1 L 11.5 4.1 L 14.8 2.8 L 18.1 7.9 Z M 20 13.7 A 6.3 6.3 0 1 0 20 26.3 A 6.3 6.3 0 1 0 20 13.7 Z\" fill=\"#000000\" fill-rule=\"evenodd\"/></svg> </button>"
      },
      {
        "shape": "gear-14-fine",
        "nameKey": "collaborative.shape_gear_14_fine",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-gear-14-fine\" data-shape=\"gear-14-fine\" data-i18n-tooltip=\"collaborative.shape_gear_14_fine\" data-i18n-aria=\"collaborative.shape_gear_14_fine\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 20.0 4.9 L 21.8 2.1 L 24.2 2.5 L 25.0 5.7 L 26.6 6.4 L 29.4 4.6 L 31.4 6.1 L 30.7 9.3 L 31.8 10.6 L 35.1 10.2 L 36.3 12.4 L 34.3 15.0 L 34.7 16.6 L 37.9 17.7 L 38.0 20.2 L 35.0 21.7 L 34.7 23.4 L 37.1 25.7 L 36.1 28.0 L 32.8 28.0 L 31.8 29.4 L 32.9 32.6 L 31.0 34.2 L 28.0 32.8 L 26.6 33.6 L 26.2 36.9 L 23.8 37.6 L 21.7 35.0 L 20.0 35.1 L 18.2 37.9 L 15.8 37.5 L 15.0 34.3 L 13.4 33.6 L 10.6 35.4 L 8.6 33.9 L 9.3 30.7 L 8.2 29.4 L 4.9 29.8 L 3.7 27.6 L 5.7 25.0 L 5.3 23.4 L 2.1 22.3 L 2.0 19.8 L 5.0 18.3 L 5.3 16.6 L 2.9 14.3 L 3.9 12.0 L 7.2 12.0 L 8.2 10.6 L 7.1 7.4 L 9.0 5.8 L 12.0 7.2 L 13.4 6.4 L 13.8 3.1 L 16.2 2.4 L 18.3 5.0 Z M 20 13.7 A 6.3 6.3 0 1 0 20 26.3 A 6.3 6.3 0 1 0 20 13.7 Z\" fill=\"#000000\" fill-rule=\"evenodd\"/></svg> </button>"
      },
      {
        "shape": "gear-12-industrial",
        "nameKey": "collaborative.shape_gear_12_industrial",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-gear-12-industrial\" data-shape=\"gear-12-industrial\" data-i18n-tooltip=\"collaborative.shape_gear_12_industrial\" data-i18n-aria=\"collaborative.shape_gear_12_industrial\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 20.0 6.7 L 22.1 2.1 L 24.9 2.7 L 25.1 7.7 L 26.7 8.5 L 30.7 5.5 L 32.9 7.5 L 30.6 11.9 L 31.5 13.3 L 36.5 12.9 L 37.5 15.6 L 33.2 18.3 L 33.3 20.0 L 37.9 22.1 L 37.3 24.9 L 32.3 25.1 L 31.5 26.7 L 34.5 30.7 L 32.5 32.9 L 28.1 30.6 L 26.7 31.5 L 27.1 36.5 L 24.4 37.5 L 21.7 33.2 L 20.0 33.3 L 17.9 37.9 L 15.1 37.3 L 14.9 32.3 L 13.3 31.5 L 9.3 34.5 L 7.1 32.5 L 9.4 28.1 L 8.5 26.7 L 3.5 27.1 L 2.5 24.4 L 6.8 21.7 L 6.7 20.0 L 2.1 17.9 L 2.7 15.1 L 7.7 14.9 L 8.5 13.3 L 5.5 9.3 L 7.5 7.1 L 11.9 9.4 L 13.3 8.5 L 12.9 3.5 L 15.6 2.5 L 18.3 6.8 Z M 20 13.7 A 6.3 6.3 0 1 0 20 26.3 A 6.3 6.3 0 1 0 20 13.7 Z\" fill=\"#000000\" fill-rule=\"evenodd\"/></svg> </button>"
      },
      {
        "shape": "gear-16",
        "nameKey": "collaborative.shape_gear_16",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-gear-16\" data-shape=\"gear-16\" data-i18n-tooltip=\"collaborative.shape_gear_16\" data-i18n-aria=\"collaborative.shape_gear_16\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 20.0 5.2 L 21.6 2.1 L 23.7 2.4 L 24.3 5.9 L 25.6 6.4 L 28.3 4.0 L 30.2 5.2 L 29.4 8.6 L 30.4 9.6 L 33.8 8.4 L 35.1 10.2 L 33.0 13.0 L 33.6 14.4 L 37.2 14.6 L 37.7 16.7 L 34.7 18.6 L 34.8 20.0 L 37.9 21.6 L 37.6 23.7 L 34.1 24.3 L 33.6 25.6 L 36.0 28.3 L 34.8 30.2 L 31.4 29.4 L 30.4 30.4 L 31.6 33.8 L 29.8 35.1 L 27.0 33.0 L 25.6 33.6 L 25.4 37.2 L 23.3 37.7 L 21.4 34.7 L 20.0 34.8 L 18.4 37.9 L 16.3 37.6 L 15.7 34.1 L 14.4 33.6 L 11.7 36.0 L 9.8 34.8 L 10.6 31.4 L 9.6 30.4 L 6.2 31.6 L 4.9 29.8 L 7.0 27.0 L 6.4 25.6 L 2.8 25.4 L 2.3 23.3 L 5.3 21.4 L 5.2 20.0 L 2.1 18.4 L 2.4 16.3 L 5.9 15.7 L 6.4 14.4 L 4.0 11.7 L 5.2 9.8 L 8.6 10.6 L 9.6 9.6 L 8.4 6.2 L 10.2 4.9 L 13.0 7.0 L 14.4 6.4 L 14.6 2.8 L 16.7 2.3 L 18.6 5.3 Z M 20 13.7 A 6.3 6.3 0 1 0 20 26.3 A 6.3 6.3 0 1 0 20 13.7 Z\" fill=\"#000000\" fill-rule=\"evenodd\"/></svg> </button>"
      }
    ]
  },
  "banners": {
    "id": "banners",
    "titleKey": "collaborative.shape_cat_banners",
    "shapes": [
      {
        "shape": "banner-ribbon-horizontal",
        "nameKey": "collaborative.shape_banner_ribbon_horizontal",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-banner-ribbon-horizontal\" data-shape=\"banner-ribbon-horizontal\" data-i18n-tooltip=\"collaborative.shape_banner_ribbon_horizontal\" data-i18n-aria=\"collaborative.shape_banner_ribbon_horizontal\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 2 10 L 8 20 L 2 30 H 38 L 32 20 L 38 10 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "banner-pennant-point",
        "nameKey": "collaborative.shape_banner_pennant_point",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-banner-pennant-point\" data-shape=\"banner-pennant-point\" data-i18n-tooltip=\"collaborative.shape_banner_pennant_point\" data-i18n-aria=\"collaborative.shape_banner_pennant_point\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"5,2 35,2 35,27 20,38 5,27\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "banner-swallowtail",
        "nameKey": "collaborative.shape_banner_swallowtail",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-banner-swallowtail\" data-shape=\"banner-swallowtail\" data-i18n-tooltip=\"collaborative.shape_banner_swallowtail\" data-i18n-aria=\"collaborative.shape_banner_swallowtail\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"5,2 35,2 35,38 20,30 5,38\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "banner-shield-pennant",
        "nameKey": "collaborative.shape_banner_shield_pennant",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-banner-shield-pennant\" data-shape=\"banner-shield-pennant\" data-i18n-tooltip=\"collaborative.shape_banner_shield_pennant\" data-i18n-aria=\"collaborative.shape_banner_shield_pennant\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"7,2 33,2 33,27 20,38 7,27\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "banner-ribbon-vertical",
        "nameKey": "collaborative.shape_banner_ribbon_vertical",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-banner-ribbon-vertical\" data-shape=\"banner-ribbon-vertical\" data-i18n-tooltip=\"collaborative.shape_banner_ribbon_vertical\" data-i18n-aria=\"collaborative.shape_banner_ribbon_vertical\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"7,2 33,2 33,38 20,30 7,38\" fill=\"#000000\"/></svg> </button>"
      }
    ]
  },
  "asterisks": {
    "id": "asterisks",
    "titleKey": "collaborative.shape_cat_asterisks",
    "shapes": [
      {
        "shape": "asterisk-6-thin",
        "nameKey": "collaborative.shape_asterisk_6_thin",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-asterisk-6-thin\" data-shape=\"asterisk-6-thin\" data-i18n-tooltip=\"collaborative.shape_asterisk_6_thin\" data-i18n-aria=\"collaborative.shape_asterisk_6_thin\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20.0,2.0 21.6,17.2 35.6,11.0 23.2,20.0 35.6,29.0 21.6,22.8 20.0,38.0 18.4,22.8 4.4,29.0 16.8,20.0 4.4,11.0 18.4,17.2\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "asterisk-6-thick",
        "nameKey": "collaborative.shape_asterisk_6_thick",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-asterisk-6-thick\" data-shape=\"asterisk-6-thick\" data-i18n-tooltip=\"collaborative.shape_asterisk_6_thick\" data-i18n-aria=\"collaborative.shape_asterisk_6_thick\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20.0,2.0 23.8,13.5 35.6,11.0 27.6,20.0 35.6,29.0 23.8,26.5 20.0,38.0 16.2,26.5 4.4,29.0 12.4,20.0 4.4,11.0 16.2,13.5\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "asterisk-5-rounded",
        "nameKey": "collaborative.shape_asterisk_5_rounded",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-asterisk-5-rounded\" data-shape=\"asterisk-5-rounded\" data-i18n-tooltip=\"collaborative.shape_asterisk_5_rounded\" data-i18n-aria=\"collaborative.shape_asterisk_5_rounded\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20.0,2.0 25.1,13.0 37.1,14.4 28.2,22.7 30.6,34.6 20.0,28.6 9.4,34.6 11.8,22.7 2.9,14.4 14.9,13.0\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "asterisk-8-snow",
        "nameKey": "collaborative.shape_asterisk_8_snow",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-asterisk-8-snow\" data-shape=\"asterisk-8-snow\" data-i18n-tooltip=\"collaborative.shape_asterisk_8_snow\" data-i18n-aria=\"collaborative.shape_asterisk_8_snow\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20.0,2.0 22.4,14.2 32.7,7.3 25.8,17.6 38.0,20.0 25.8,22.4 32.7,32.7 22.4,25.8 20.0,38.0 17.6,25.8 7.3,32.7 14.2,22.4 2.0,20.0 14.2,17.6 7.3,7.3 17.6,14.2\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "asterisk-5-thin",
        "nameKey": "collaborative.shape_asterisk_5_thin",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-asterisk-5-thin\" data-shape=\"asterisk-5-thin\" data-i18n-tooltip=\"collaborative.shape_asterisk_5_thin\" data-i18n-aria=\"collaborative.shape_asterisk_5_thin\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><polygon points=\"20.0,2.0 22.3,16.8 37.1,14.4 23.8,21.2 30.6,34.6 20.0,24.0 9.4,34.6 16.2,21.2 2.9,14.4 17.7,16.8\" fill=\"#000000\"/></svg> </button>"
      }
    ]
  },
  "organic": {
    "id": "organic",
    "titleKey": "collaborative.shape_cat_organic",
    "shapes": [
      {
        "shape": "organic-daisy-8",
        "nameKey": "collaborative.shape_organic_daisy_8",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-organic-daisy-8\" data-shape=\"organic-daisy-8\" data-i18n-tooltip=\"collaborative.shape_organic_daisy_8\" data-i18n-aria=\"collaborative.shape_organic_daisy_8\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 24.5 20.0 C 38.6 23.3, 36.6 26.9, 36.6 26.9 C 36.6 26.9, 35.5 30.8, 23.2 23.2 C 30.8 35.5, 26.9 36.6, 26.9 36.6 C 26.9 36.6, 23.3 38.6, 20.0 24.5 C 16.7 38.6, 13.1 36.6, 13.1 36.6 C 13.1 36.6, 9.2 35.5, 16.8 23.2 C 4.5 30.8, 3.4 26.9, 3.4 26.9 C 3.4 26.9, 1.4 23.3, 15.5 20.0 C 1.4 16.7, 3.4 13.1, 3.4 13.1 C 3.4 13.1, 4.5 9.2, 16.8 16.8 C 9.2 4.5, 13.1 3.4, 13.1 3.4 C 13.1 3.4, 16.7 1.4, 20.0 15.5 C 23.3 1.4, 26.9 3.4, 26.9 3.4 C 26.9 3.4, 30.8 4.5, 23.2 16.8 C 35.5 9.2, 36.6 13.1, 36.6 13.1 C 36.6 13.1, 38.6 16.7, 24.5 20.0 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "organic-flower-6",
        "nameKey": "collaborative.shape_organic_flower_6",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-organic-flower-6\" data-shape=\"organic-flower-6\" data-i18n-tooltip=\"collaborative.shape_organic_flower_6\" data-i18n-aria=\"collaborative.shape_organic_flower_6\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 25.0 20.0 C 38.4 24.4, 35.6 29.0, 35.6 29.0 C 35.6 29.0, 33.0 33.7, 22.5 24.4 C 25.4 38.1, 20.0 38.0, 20.0 38.0 C 20.0 38.0, 14.6 38.1, 17.5 24.4 C 7.0 33.7, 4.4 29.0, 4.4 29.0 C 4.4 29.0, 1.6 24.4, 15.0 20.0 C 1.6 15.6, 4.4 11.0, 4.4 11.0 C 4.4 11.0, 7.0 6.3, 17.5 15.6 C 14.6 1.9, 20.0 2.0, 20.0 2.0 C 20.0 2.0, 25.4 1.9, 22.5 15.6 C 33.0 6.3, 35.6 11.0, 35.6 11.0 C 35.6 11.0, 38.4 15.6, 25.0 20.0 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "organic-flower-10",
        "nameKey": "collaborative.shape_organic_flower_10",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-organic-flower-10\" data-shape=\"organic-flower-10\" data-i18n-tooltip=\"collaborative.shape_organic_flower_10\" data-i18n-aria=\"collaborative.shape_organic_flower_10\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 26.8 20.0 C 38.7 22.7, 37.1 25.6, 37.1 25.6 C 37.1 25.6, 36.7 28.8, 25.5 24.0 C 33.6 33.2, 30.6 34.6, 30.6 34.6 C 30.6 34.6, 28.3 37.0, 22.1 26.5 C 23.2 38.6, 20.0 38.0, 20.0 38.0 C 20.0 38.0, 16.8 38.6, 17.9 26.5 C 11.7 37.0, 9.4 34.6, 9.4 34.6 C 9.4 34.6, 6.4 33.2, 14.5 24.0 C 3.3 28.8, 2.9 25.6, 2.9 25.6 C 2.9 25.6, 1.3 22.7, 13.2 20.0 C 1.3 17.3, 2.9 14.4, 2.9 14.4 C 2.9 14.4, 3.3 11.2, 14.5 16.0 C 6.4 6.8, 9.4 5.4, 9.4 5.4 C 9.4 5.4, 11.7 3.0, 17.9 13.5 C 16.8 1.4, 20.0 2.0, 20.0 2.0 C 20.0 2.0, 23.2 1.4, 22.1 13.5 C 28.3 3.0, 30.6 5.4, 30.6 5.4 C 30.6 5.4, 33.6 6.8, 25.5 16.0 C 36.7 11.2, 37.1 14.4, 37.1 14.4 C 37.1 14.4, 38.7 17.3, 26.8 20.0 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "organic-flower-center",
        "nameKey": "collaborative.shape_organic_flower_center",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-organic-flower-center\" data-shape=\"organic-flower-center\" data-i18n-tooltip=\"collaborative.shape_organic_flower_center\" data-i18n-aria=\"collaborative.shape_organic_flower_center\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 26.8 20.0 C 38.4 24.4, 35.6 29.0, 35.6 29.0 C 35.6 29.0, 33.0 33.7, 23.4 25.9 C 25.4 38.1, 20.0 38.0, 20.0 38.0 C 20.0 38.0, 14.6 38.1, 16.6 25.9 C 7.0 33.7, 4.4 29.0, 4.4 29.0 C 4.4 29.0, 1.6 24.4, 13.2 20.0 C 1.6 15.6, 4.4 11.0, 4.4 11.0 C 4.4 11.0, 7.0 6.3, 16.6 14.1 C 14.6 1.9, 20.0 2.0, 20.0 2.0 C 20.0 2.0, 25.4 1.9, 23.4 14.1 C 33.0 6.3, 35.6 11.0, 35.6 11.0 C 35.6 11.0, 38.4 15.6, 26.8 20.0 Z M 20 15 A 5 5 0 1 0 20 25 A 5 5 0 1 0 20 15 Z\" fill=\"#000000\" fill-rule=\"evenodd\"/></svg> </button>"
      },
      {
        "shape": "organic-clover-4",
        "nameKey": "collaborative.shape_organic_clover_4",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-organic-clover-4\" data-shape=\"organic-clover-4\" data-i18n-tooltip=\"collaborative.shape_organic_clover_4\" data-i18n-aria=\"collaborative.shape_organic_clover_4\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 20 20 C 15 13 8 13 8 18 C 8 23 15 22 20 20 C 13 25 13 32 18 32 C 23 32 22 25 20 20 C 25 27 32 27 32 22 C 32 17 25 18 20 20 C 27 15 27 8 22 8 C 17 8 18 15 20 20 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "organic-propeller-4",
        "nameKey": "collaborative.shape_organic_propeller_4",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-organic-propeller-4\" data-shape=\"organic-propeller-4\" data-i18n-tooltip=\"collaborative.shape_organic_propeller_4\" data-i18n-aria=\"collaborative.shape_organic_propeller_4\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 20 20 C 14 11 14 3 20 3 C 26 3 26 11 20 20 C 29 14 37 14 37 20 C 37 26 29 26 20 20 C 26 29 26 37 20 37 C 14 37 14 29 20 20 C 11 26 3 26 3 20 C 3 14 11 14 20 20 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "organic-leaf",
        "nameKey": "collaborative.shape_organic_leaf",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-organic-leaf\" data-shape=\"organic-leaf\" data-i18n-tooltip=\"collaborative.shape_organic_leaf\" data-i18n-aria=\"collaborative.shape_organic_leaf\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 3 37 C 3 17 19 3 37 3 C 37 23 21 37 3 37 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "organic-wave-ribbon",
        "nameKey": "collaborative.shape_organic_wave_ribbon",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-organic-wave-ribbon\" data-shape=\"organic-wave-ribbon\" data-i18n-tooltip=\"collaborative.shape_organic_wave_ribbon\" data-i18n-aria=\"collaborative.shape_organic_wave_ribbon\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 3 16 Q 11 9 20 16 T 37 16 V 24 Q 29 31 20 24 T 3 24 Z\" fill=\"#000000\"/></svg> </button>"
      },
      {
        "shape": "organic-s-ribbon",
        "nameKey": "collaborative.shape_organic_s_ribbon",
        "cardHtml": "<button type=\"button\" class=\"collaborative-shape-card\" data-ref=\"btn-panel-shape-organic-s-ribbon\" data-shape=\"organic-s-ribbon\" data-i18n-tooltip=\"collaborative.shape_organic_s_ribbon\" data-i18n-aria=\"collaborative.shape_organic_s_ribbon\"> <svg class=\"collaborative-shape-card__svg\" viewBox=\"0 0 40 40\" width=\"32\" height=\"32\"><path d=\"M 3 22 C 12 12 28 28 37 18 C 30 25 15 15 3 22 Z\" fill=\"#000000\"/></svg> </button>"
      }
    ]
  }
};

export { SHAPES_CATALOG };
export type { ShapeCategory, ShapeDefinition };
