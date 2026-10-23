"""JSON Schemas for POST /v1/check — copied verbatim from the
RouteVerdict service's own discovery document (/.well-known/x402 in
QuincyGB/route-verdict), which is the service's published contract.
Keep these in sync with the service, never fork them.
"""


CHECK_INPUT_SCHEMA = {'type': 'object',
 'required': ['resource_url'],
 'properties': {'resource_url': {'type': 'string',
                                 'description': 'Full URL of the x402 resource to '
                                                'audit, e.g. '
                                                'https://service.example.com/v1/endpoint'}}}


CHECK_OUTPUT_SCHEMA = {'type': 'object',
 'required': ['resource_url',
              'checked_at',
              'verdict',
              'score',
              'reasons',
              'liveness',
              'terms',
              'schema_quality',
              'catalog',
              'diff'],
 'properties': {'resource_url': {'type': 'string'},
                'checked_at': {'type': 'string',
                               'description': 'ISO-8601 timestamp of the probe'},
                'verdict': {'type': 'string', 'enum': ['TRUSTED', 'CAUTION', 'AVOID']},
                'score': {'type': 'number',
                          'minimum': 0,
                          'maximum': 100,
                          'description': 'Trust score: 100 (fully trusted) to 0, from '
                                         'the itemized deductions in reasons'},
                'reasons': {'type': 'array',
                            'items': {'type': 'object',
                                      'required': ['name', 'deduction', 'detail'],
                                      'properties': {'name': {'type': 'string'},
                                                     'deduction': {'type': 'integer',
                                                                   'minimum': 0},
                                                     'detail': {'type': 'string'}}}},
                'liveness': {'type': 'object',
                             'required': ['alive',
                                          'http_status',
                                          'latency_ms',
                                          'method',
                                          'x402_valid',
                                          'parse_error'],
                             'properties': {'alive': {'type': 'boolean',
                                                      'description': 'The endpoint '
                                                                     'returned an HTTP '
                                                                     'response at all'},
                                            'http_status': {'type': ['integer',
                                                                     'null']},
                                            'latency_ms': {'type': ['integer', 'null']},
                                            'method': {'type': ['string', 'null'],
                                                       'enum': ['GET', 'POST', None]},
                                            'x402_valid': {'type': 'boolean',
                                                           'description': 'The '
                                                                          'response '
                                                                          'parses as a '
                                                                          'valid x402 '
                                                                          'challenge'},
                                            'parse_error': {'type': ['string',
                                                                     'null']}}},
                'terms': {'type': 'object',
                          'required': ['found',
                                       'price_usdc',
                                       'amount_units',
                                       'network',
                                       'asset',
                                       'pay_to',
                                       'scheme',
                                       'x402_version'],
                          'properties': {'found': {'type': 'boolean'},
                                         'price_usdc': {'type': ['string', 'null'],
                                                        'description': 'Formatted '
                                                                       'price like '
                                                                       '$0.02 for '
                                                                       'known assets; '
                                                                       'null when '
                                                                       'asset decimals '
                                                                       'are unknown'},
                                         'amount_units': {'type': ['string', 'null'],
                                                          'description': 'Price in '
                                                                         'asset '
                                                                         'smallest '
                                                                         'units, '
                                                                         'exactly as '
                                                                         'published'},
                                         'network': {'type': ['string', 'null']},
                                         'asset': {'type': ['string', 'null']},
                                         'pay_to': {'type': ['string', 'null']},
                                         'scheme': {'type': ['string', 'null']},
                                         'x402_version': {'type': ['integer',
                                                                   'null']}}},
                'schema_quality': {'type': 'object',
                                   'required': ['extension_present',
                                                'hollow',
                                                'score',
                                                'deductions'],
                                   'properties': {'extension_present': {'type': 'boolean'},
                                                  'hollow': {'type': ['boolean',
                                                                      'null'],
                                                             'description': 'True when '
                                                                            'the '
                                                                            'output is '
                                                                            'example-only/untyped; '
                                                                            'null when '
                                                                            'no '
                                                                            'extension '
                                                                            'exists'},
                                                  'score': {'type': ['integer', 'null'],
                                                            'description': '0-100; '
                                                                           'null when '
                                                                           'no '
                                                                           'extension '
                                                                           'exists'},
                                                  'deductions': {'type': 'array',
                                                                 'items': {'type': 'object',
                                                                           'required': ['name',
                                                                                        'points',
                                                                                        'detail'],
                                                                           'properties': {'name': {'type': 'string'},
                                                                                          'points': {'type': 'integer',
                                                                                                     'minimum': 0},
                                                                                          'detail': {'type': 'string'}}}}}},
                'catalog': {'type': 'object',
                            'required': ['cdp_bazaar', 'payai'],
                            'properties': {'cdp_bazaar': {'type': 'object',
                                                          'required': ['status',
                                                                       'unique_payers_30d',
                                                                       'total_calls_30d',
                                                                       'last_called_at',
                                                                       'detail'],
                                                          'properties': {'status': {'type': 'string',
                                                                                    'enum': ['listed',
                                                                                             'not_listed',
                                                                                             'unknown']},
                                                                         'unique_payers_30d': {'type': ['integer',
                                                                                                        'null']},
                                                                         'total_calls_30d': {'type': ['integer',
                                                                                                      'null']},
                                                                         'last_called_at': {'type': ['string',
                                                                                                     'null']},
                                                                         'detail': {'type': 'string'}}},
                                           'payai': {'type': 'object',
                                                     'required': ['status',
                                                                  'unique_payers_30d',
                                                                  'total_calls_30d',
                                                                  'last_called_at',
                                                                  'detail'],
                                                     'properties': {'status': {'type': 'string',
                                                                               'enum': ['listed',
                                                                                        'not_listed',
                                                                                        'unknown']},
                                                                    'unique_payers_30d': {'type': ['integer',
                                                                                                   'null']},
                                                                    'total_calls_30d': {'type': ['integer',
                                                                                                 'null']},
                                                                    'last_called_at': {'type': ['string',
                                                                                                'null']},
                                                                    'detail': {'type': 'string'}}}}},
                'diff': {'type': 'object',
                         'required': ['prior_check',
                                      'prior_checked_at',
                                      'changes',
                                      'summary'],
                         'properties': {'prior_check': {'type': 'boolean'},
                                        'prior_checked_at': {'type': ['string',
                                                                      'null']},
                                        'changes': {'type': 'array',
                                                    'items': {'type': 'object',
                                                              'required': ['field',
                                                                           'before',
                                                                           'after',
                                                                           'detail'],
                                                              'properties': {'field': {'type': 'string'},
                                                                             'before': {'type': ['string',
                                                                                                 'null']},
                                                                             'after': {'type': ['string',
                                                                                                'null']},
                                                                             'detail': {'type': 'string'}}}},
                                        'summary': {'type': 'string'}}}}}
