grammar Control

entry Architecture:
  'architecture' name=Name title=STRING '{' ('description' description=STRING)?
    (quantities+=Quantity
    | components+=Component
    | powerLinks+=PowerLink
    | modes+=Mode
    | blocks+=Block
    | signals+=Signal
    | views+=View
    | ('note' notes+=STRING))*
  '}';

Quantity:
  'quantity' name=Name symbol=STRING label=STRING ('unit' unit=STRING)? (exclusive?='exclusive')?;
Component:
  'component' name=Name kind=ComponentKind label=STRING ('technology' technology=STRING)? ('in' parent=[Component:Name])?;
ComponentKind returns string: 'external' | 'converter' | 'bus' | 'subsystem';
PowerLink:
  'power' name=Name from=[Component:Name] '->' to=[Component:Name] capability=Capability;
Capability returns string: 'forward' | 'bidirectional';
Mode:
  'mode' name=Name label=STRING 'group' group=STRING ('extends' parent=[Mode:Name])? '{'
  ('note' note=STRING)? (flows+=ModeFlow | controls+=ControlSet)* '}';
ModeFlow: 'flow' link=[PowerLink:Name] direction=Flow;
Flow returns string: 'forward' | 'reverse' | 'bidirectional' | 'off';
ControlSet: 'controls' owner=[Component:Name] '{' assignments+=Assignment* '}';
Assignment: quantity=[Quantity:Name] role=Role;
Role returns string: 'regulator' | 'inner-loop' | 'command' | 'limit' | 'unspecified';
Block:
  'block' name=Name kind=BlockKind label=STRING ('owner' owner=[Component:Name])?
  ('modes' modes+=[Mode:Name] (',' modes+=[Mode:Name])*)?
  '{' ('detail' detail=STRING)? ('math' math=STRING)? ports+=Port* '}';
BlockKind returns string: 'reference' | 'controller' | 'sum' | 'gain' | 'integrator' | 'transfer' | 'limiter' | 'plant' | 'measurement' | 'junction' | 'switch';
Port: 'port' name=Name direction=PortDirection side=Side ('quantity' quantity=[Quantity:Name])? ('sign' sign=Sign)?;
PortDirection returns string: 'in' | 'out';
Side returns string: 'WEST' | 'EAST' | 'NORTH' | 'SOUTH';
Sign returns string: '+' | '-';
Signal:
  'signal' name=Name from=Endpoint '->' to=Endpoint ('label' label=STRING)? (feedback?='feedback')? ('quantity' quantity=[Quantity:Name])?;
Endpoint: block=[Block:Name] '.' port=Name;
View:
  'view' name=Name kind=ViewKind title=STRING ('mode' mode=[Mode:Name])? '{'
  ('include' include+=Name (',' include+=Name)*)? ('focus' focus=Name 'depth' depth=INT)? ('direction' direction=Direction)? (grouped?='grouped')? '}';
ViewKind returns string: 'overview' | 'power' | 'control' | 'matrix';
Direction returns string: 'RIGHT' | 'DOWN';

terminal ID: /[a-z][a-zA-Z0-9_-]*/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /"([^"\\]|\\.)*"/;
hidden terminal WS: /\s+/;
hidden terminal COMMENT: /\/\/[^\n\r]*/;
hidden terminal BLOCK_COMMENT: /\/\*[\s\S]*?\*\//;

Name returns string: ID | 'DOWN' | 'EAST' | 'NORTH' | 'RIGHT' | 'SOUTH' | 'WEST' | 'architecture' | 'bidirectional' | 'block' | 'bus' | 'command' | 'component' | 'control' | 'controller' | 'controls' | 'converter' | 'depth' | 'description' | 'detail' | 'direction' | 'exclusive' | 'extends' | 'external' | 'feedback' | 'flow' | 'focus' | 'forward' | 'gain' | 'group' | 'grouped' | 'in' | 'include' | 'inner-loop' | 'integrator' | 'junction' | 'label' | 'limit' | 'limiter' | 'math' | 'matrix' | 'measurement' | 'mode' | 'modes' | 'note' | 'off' | 'out' | 'overview' | 'owner' | 'plant' | 'port' | 'power' | 'quantity' | 'reference' | 'regulator' | 'reverse' | 'sign' | 'signal' | 'subsystem' | 'sum' | 'switch' | 'technology' | 'transfer' | 'unit' | 'unspecified' | 'view';
