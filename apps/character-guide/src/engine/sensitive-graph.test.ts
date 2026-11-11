import {it,expect} from 'vitest';import {graphPoints,graphIndex} from './sensitive-graph';
it('has four bounded meaningful datapoints',()=>{expect(graphPoints.length).toBe(4);for(const p of graphPoints){expect(p.target.x).toBeGreaterThan(0);expect(p.target.x).toBeLessThan(1);expect(p.target.y).toBeGreaterThan(.14);expect(p.sales).toBeGreaterThan(0);}});
it('clamps navigation at endpoints',()=>{expect(graphIndex(-1)).toBe(0);expect(graphIndex(4)).toBe(3);expect(graphIndex(NaN)).toBe(0);});
it('includes privacy limits and no actions in explanations',()=>expect(graphPoints[3].explanation).toContain('No staffing change'));
