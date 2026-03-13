import React, { useRef } from 'react';

const LeadPackInfoTab = () => {
  // Create refs for each section
  const codePackRef = useRef(null);
  const releasePackRef = useRef(null);
  const f90GroupRef = useRef(null);
  const monthlyAllotmentsRef = useRef(null);
  const posEligibilityRef = useRef(null);
  const sixkRuleRef = useRef(null);
  const referralsRef = useRef(null);
  const referralReupRef = useRef(null);
  const top5AgentsRef = useRef(null);
  const expectedAlpRef = useRef(null);
  const vipAgentsRef = useRef(null);

  const scrollToSection = (ref) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{ display: 'flex', gap: '24px' }}>
      {/* Table of Contents */}
      <div style={{
        minWidth: '220px',
        maxWidth: '220px',
        position: 'sticky',
        top: '20px',
        height: 'fit-content',
        backgroundColor: '#f8f9fa',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h4 style={{ 
          marginTop: 0, 
          marginBottom: '16px', 
          color: '#00558c',
          fontSize: '14px',
          fontWeight: 'bold'
        }}>
          Contents
        </h4>
        <nav>
          <ul style={{ 
            listStyle: 'none', 
            padding: 0, 
            margin: 0,
            fontSize: '13px'
          }}>
            <li style={{ marginBottom: '8px' }}>
              <button
                onClick={() => scrollToSection(codePackRef)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#00558c',
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: '4px 0',
                  textDecoration: 'none',
                  display: 'block',
                  width: '100%'
                }}
                onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.target.style.textDecoration = 'none'}
              >
                Code Pack
              </button>
            </li>
            <li style={{ marginBottom: '8px' }}>
              <button
                onClick={() => scrollToSection(releasePackRef)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#00558c',
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: '4px 0',
                  textDecoration: 'none',
                  display: 'block',
                  width: '100%'
                }}
                onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.target.style.textDecoration = 'none'}
              >
                Release Pack
              </button>
            </li>
            <li style={{ marginBottom: '8px' }}>
              <button
                onClick={() => scrollToSection(f90GroupRef)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#00558c',
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: '4px 0',
                  textDecoration: 'none',
                  display: 'block',
                  width: '100%'
                }}
                onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.target.style.textDecoration = 'none'}
              >
                F90 Group
              </button>
            </li>
            <li style={{ marginBottom: '8px' }}>
              <button
                onClick={() => scrollToSection(monthlyAllotmentsRef)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#00558c',
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: '4px 0',
                  textDecoration: 'none',
                  display: 'block',
                  width: '100%'
                }}
                onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.target.style.textDecoration = 'none'}
              >
                Monthly Allotments
              </button>
            </li>
            <li style={{ marginBottom: '8px' }}>
              <button
                onClick={() => scrollToSection(posEligibilityRef)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#00558c',
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: '4px 0',
                  textDecoration: 'none',
                  display: 'block',
                  width: '100%'
                }}
                onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.target.style.textDecoration = 'none'}
              >
                POS Eligibility
              </button>
            </li>
            <li style={{ marginBottom: '8px' }}>
              <button
                onClick={() => scrollToSection(sixkRuleRef)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#00558c',
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: '4px 0',
                  textDecoration: 'none',
                  display: 'block',
                  width: '100%'
                }}
                onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.target.style.textDecoration = 'none'}
              >
                6k Rule
              </button>
            </li>
            <li style={{ marginBottom: '8px' }}>
              <button
                onClick={() => scrollToSection(referralsRef)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#00558c',
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: '4px 0',
                  textDecoration: 'none',
                  display: 'block',
                  width: '100%'
                }}
                onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.target.style.textDecoration = 'none'}
              >
                Referrals
              </button>
            </li>
            <li style={{ marginBottom: '8px' }}>
              <button
                onClick={() => scrollToSection(referralReupRef)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#00558c',
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: '4px 0',
                  textDecoration: 'none',
                  display: 'block',
                  width: '100%'
                }}
                onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.target.style.textDecoration = 'none'}
              >
                Referral Reup
              </button>
            </li>
            <li style={{ marginBottom: '8px' }}>
              <button
                onClick={() => scrollToSection(top5AgentsRef)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#00558c',
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: '4px 0',
                  textDecoration: 'none',
                  display: 'block',
                  width: '100%'
                }}
                onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.target.style.textDecoration = 'none'}
              >
                Top 5 Agents
              </button>
            </li>
            <li style={{ marginBottom: '8px' }}>
              <button
                onClick={() => scrollToSection(expectedAlpRef)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#00558c',
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: '4px 0',
                  textDecoration: 'none',
                  display: 'block',
                  width: '100%'
                }}
                onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.target.style.textDecoration = 'none'}
              >
                Expected ALP per Lead
              </button>
            </li>
            <li style={{ marginBottom: '8px' }}>
              <button
                onClick={() => scrollToSection(vipAgentsRef)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#00558c',
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: '4px 0',
                  textDecoration: 'none',
                  display: 'block',
                  width: '100%'
                }}
                onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.target.style.textDecoration = 'none'}
              >
                VIP Agents
              </button>
            </li>
          </ul>
        </nav>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1 }}>
        <h2 style={{ marginTop: 0, marginBottom: '24px', color: '#00558c' }}>Lead Pack Information</h2>
        
        <div style={{ lineHeight: '1.8', fontSize: '14px' }}>
        <h3 ref={codePackRef} style={{ color: '#00558c', marginTop: '24px', marginBottom: '12px', scrollMarginTop: '20px' }}>Code Pack</h3>
        <p>
          50 HC leads are issued upon approved code sale.<br />
          Agent will keep these for 30 days then they will be washed.
        </p>
        <p>
          Agent must be in the Arias system; have an Impact account set up and have requested a code pack.
        </p>

        <div style={{ margin: '16px 0', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h4 style={{ color: '#00558c', marginTop: 0, marginBottom: '12px', fontSize: '14px' }}>How Code Packs Work</h4>
          <p>
            When an agent joins and writes their first approved business with net Annualized Life Premium (ALP), they become eligible for a Code Pack.
          </p>
          <p>
            The Daily New Associates Report from home office arrives between 10 AM and 2 PM, showing pending and coded agents. Once processed, the system updates and shows the agent as coded, making them eligible for a Code Pack request.
          </p>
          <p>
            To request, visit <strong>agents.ariaslife.com</strong>, go to <strong>Resources &gt; Leads &gt; Code Pack</strong> tab. Eligible agents appear in the table.
          </p>
          <p>
            Before requesting, add the agent's resident state license in the Action column. For additional states, use the Licensing page under Resources.
          </p>
          <p>
            Once licenses are added, the button changes to <strong>Request</strong>. The request is sent to a staff member who builds and sends the Code Pack within 24-48 hours.
          </p>
          <p>
            Staff can communicate delays in the Reasoning column (e.g. agent previously active, lack of leads, Impact account issues). Managers get notified and can also check the table for updates.
          </p>
          <p>
            After the Code Pack is sent, managers are notified and they can verify in the table.
          </p>
          <p style={{ fontStyle: 'italic', color: '#666', marginBottom: 0 }}>
            If the agent hasn't appeared yet, ensure the code app was sent from eApp to AWS, then to home office, and shows on ICM. There can be a delay before they show in AriasLife, depending on when home office processes it. If this is not resolved within 48 hours of completing these steps, please reach out to shochreiter@ariasagencies.com to determine next best steps in resolving this issue.
          </p>
        </div>

        <h3 ref={releasePackRef} style={{ color: '#00558c', marginTop: '24px', marginBottom: '12px', scrollMarginTop: '20px' }}>Release Pack</h3>
        <p>
          100 HC leads issued once agent has 1k in approved business and has passed a release call with Justin Adams. 
          Agent can keep these for 30 days then they will be washed.<br />
          If agent is coded under 7 days - their release pack will be increased to 125 leads.
        </p>
        <p>
          <a 
            href="https://aagencies-my.sharepoint.com/:p:/g/personal/kvanbibber_ariasagencies_com/EWTlyjLsBK1LpgQ5uD225EIB-8HvmkOrRVIrDAKqvyS8wA" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              color: '#00558c', 
              textDecoration: 'underline',
              fontStyle: 'italic' 
            }}
          >
            Release System.pptx
          </a>
        </p>
        <p>
          You can check the status of a request on the Arias Life portal.<br />
          Notes / updates from the lead team are added there if any additional requirements are needed.
        </p>
        <p>
          Agents outside of their F30 period will receive leads via the monthly distribution list.<br />
          They now move into the F90 category.
        </p>

        <h3 ref={f90GroupRef} style={{ color: '#00558c', marginTop: '32px', marginBottom: '12px', scrollMarginTop: '20px' }}>F90 Group (day 31 - day 90)</h3>
        <p>
          Agents need to be above the minimum of 3k gross production from their first 30 days / from the corresponding months P&P.
        </p>
        <p>
          Agents receive 150 leads for the month.<br />
          Issued as 75 HC leads in each of the bi-weekly lead drops.<br />
          These are washed on a 2 week cycle that aligns with each new lead drop.
        </p>

        <h3 ref={monthlyAllotmentsRef} style={{ color: '#00558c', marginTop: '32px', marginBottom: '12px', scrollMarginTop: '20px' }}>Monthly Allotments (month 4 onwards)</h3>
        <p>
          Agents need a minimum of 3k gross ALP in the corresponding month to be allotted leads.<br />
          This is a 2 month cycle. E.g. March leads are based on January P&Ps.
        </p>
        <p>
          Agents are ranked by their production and then divided into groups 1-5.<br />
          Groups are determined by the number of agents over 3k, divided by 5.<br />
          <em>e.g. With 100 qualifying agents, each group would consist of 20 agents.<br />
          If 150 qualifying agents, each group would consist of 30 agents.</em>
        </p>
        
        <div style={{ margin: '16px 0', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <strong>Group 1:</strong> 500 leads per month - issued as 250 leads every 2 weeks<br />
          <strong>Group 2:</strong> 400 leads per month - issued as 200 leads every 2 weeks<br />
          <strong>Group 3:</strong> 300 leads per month - issued as 150 leads every 2 weeks<br />
          <strong>Group 4:</strong> 200 leads per month - issued as 100 leads every 2 weeks<br />
          <strong>Group 5:</strong> 150 leads per month - issued as 75 leads every 2 weeks
        </div>

        <p style={{ fontStyle: 'italic', color: '#856404', backgroundColor: '#fff3cd', padding: '12px', borderRadius: '4px' }}>
          *The top 10 agents from group 4 will be placed in a HOT LEADS category*.<br />
          They will still receive 200 leads for the month.<br />
          100 of these will be VN125 Globe life leads and will be issued daily as they arrive.
        </p>

        <div style={{ margin: '16px 0', padding: '16px', backgroundColor: '#e7f3ff', borderRadius: '4px' }}>
          <strong>Group 1</strong> - POS / HC / Dcards<br />
          <strong>Group 2</strong> - POS / HC / dcards<br />
          <strong>Group 3</strong> - HC / School leads / dcard<br />
          <strong>Group 4</strong> - HCs / school leads / Globe life leads<br />
          <strong>Group 5</strong> - vendor leads
        </div>

        <p>
          Groups 1-3 will receive close to 15% of their leads as dcards in each lead drop.
        </p>

        <h3 ref={posEligibilityRef} style={{ color: '#00558c', marginTop: '32px', marginBottom: '12px', scrollMarginTop: '20px' }}>POS Eligibility</h3>
        <ul>
          <li>Agents must be in group 1 or 2.</li>
          <li>Must have a personal 25k+ sales history.</li>
          <li>If over 13 months with the AIL - must have a 76%+ retention score.</li>
          <li>If under 13 months with AIL - must have a NTG score of 85+.</li>
        </ul>

        <h3 ref={sixkRuleRef} style={{ color: '#00558c', marginTop: '32px', marginBottom: '12px', scrollMarginTop: '20px' }}>6k Rule</h3>
        <p>
          If an agent (past F30) is not included on the allotments due to lack of production (under 3k on P&P).<br />
          They can be added back to Group 5 if they have written 6k gross in the time between the next allotment.
        </p>
        <p>
          <em>Eg. March leads are issued based on January production.<br />
          The 6k can be spread over the 2 months – so an agent wrote 2k in January, so misses out on allotment 
          but if they also wrote 4k in Feb. The 6k total would get them back on the allotment in group 5.</em>
        </p>
        <p style={{ fontWeight: 'bold' }}>
          It is the responsibility of the leader to inform the lead team if their agent is eligible for this.
        </p>

        <h3 ref={referralsRef} style={{ color: '#00558c', marginTop: '32px', marginBottom: '12px', scrollMarginTop: '20px' }}>Referrals</h3>
        <p>
          F90 agents must have 1 and allotment agents must have the matching amount of referral sales linked to their 
          allotment group from the corresponding month, or their lead amounts will be halved.
        </p>
        
        <div style={{ margin: '16px 0', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <strong>Group 1</strong> - 6 refs<br />
          <strong>Group 2</strong> - 5 refs<br />
          <strong>Group 3</strong> - 4 refs<br />
          <strong>Group 4</strong> - 3 refs<br />
          <strong>Group 5</strong> - 2 refs
        </div>

        <h3 ref={referralReupRef} style={{ color: '#00558c', marginTop: '32px', marginBottom: '12px', scrollMarginTop: '20px' }}>Referral Reup</h3>
        <p>
          Like the 6k reup - If an agent fails to hit the expected referral amount for their allotment group, 
          they can make up the difference before the corresponding lead drop - when they would lose 50% of leads.
        </p>
        <p>
          <em>Eg, group 1 agent in January gets 4 ref sales. Is short by 2 of the required 6.<br />
          If in February (assuming in G1 again) they could write 8 refs to average the 12 needed across those two months. 
          And they would get full allotment in March.</em>
        </p>
        <p>
          Allotment group is taken into account so if in G1 in Jan, but G2 in Feb the total needed would be 11.
        </p>
        <p style={{ fontWeight: 'bold' }}>
          It is the responsibility of the leader to inform the lead team if their agent is eligible for this.
        </p>

        <h3 ref={top5AgentsRef} style={{ color: '#00558c', marginTop: '32px', marginBottom: '12px', scrollMarginTop: '20px' }}>Top 5 Agents</h3>
        <p>
          Top 5 agents YTD net are issued 500 bonus leads per month (250 each drop).<br />
          If retention doesn't meet company minimum standards, the agent in the next rank below receives the leads.
        </p>

        <h3 ref={expectedAlpRef} style={{ color: '#00558c', marginTop: '32px', marginBottom: '12px', scrollMarginTop: '20px' }}>Expected ALP per Lead</h3>
        <div style={{ margin: '16px 0', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <strong>POS:</strong> 80 ALP<br />
          <strong>Hardcards / dcards / Globe life insurance leads:</strong> 50 ALP<br />
          <strong>Vendors:</strong> 30 ALP
        </div>

        <p>
          If you exceed the expected return from the leads issued in your first lead drop of the month before the next 
          scheduled lead drop, you can request an early distribution of your next set of leads. Your first lead drop will 
          be washed at this point.
        </p>
        <p>
          <strong>Bonus leads:</strong><br />
          If you exceed the expected ALP from both lead drops combined, then you are eligible to request bonus leads.
        </p>
        <p>
          In order for sales to count toward your ALP threshold, the business will need to be submitted from the first lead 
          drop date of the month and show as Std Sub MF Exported in AWS.
        </p>
        <p>
          <em>Eg. 100 POS drop 1 plus 100 POS drop 2 = 16k ALP.<br />
          If over the 16k expected ALP</em>
        </p>
        <p style={{ fontStyle: 'italic', color: '#666' }}>
          Trials, NOPRD, cancellations etc. will not count toward ALP totals
        </p>
        <p>
          Term conversions within the same time frame as the lead drops can also count. Chris Williams will approve these.
        </p>

        <h3 ref={vipAgentsRef} style={{ color: '#00558c', marginTop: '32px', marginBottom: '12px', scrollMarginTop: '20px' }}>VIP Agents</h3>
        <p>
          1st time VIP agents add 5k to their leaders' ALP ranking within allotment groups.
        </p>
        <p>
          Any VIP agent also adds their referral sales to their direct leader (as listed on the home office VIP report). 
          These are applied to correspond with the 2 month cycle of lead allotments. 
          <em>Eg. Jan VIPs will be applied to March allotments.</em>
        </p>
        </div>
      </div>
    </div>
  );
};

export default LeadPackInfoTab;

